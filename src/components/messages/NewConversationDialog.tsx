import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { SearchableSelect, type SearchableSelectOption } from "@/components/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from '@/lib/toast';

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string) => void;
}

export function NewConversationDialog({ open, onOpenChange, onConversationCreated }: NewConversationDialogProps) {
  const { user } = useAuth();
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      fetchCompanyUsers();
    }
  }, [open, user]);

  const fetchCompanyUsers = async () => {
    if (!user) return;

    // Get current user's company
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!currentProfile?.company_id) return;
    setCompanyId(currentProfile.company_id);

    // Get all users in the same company except current user
    const { data: companyProfiles } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name")
      .eq("company_id", currentProfile.company_id)
      .neq("user_id", user.id);

    if (companyProfiles) {
      setProfiles(companyProfiles);
    }
  };

  const handleCreate = async () => {
    if (!user || !companyId) return;
    if (selectedUsers.length === 0) {
      toast.error("Please select at least one user");
      return;
    }
    if (isGroup && !groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    setLoading(true);
    try {
      // Check if DM already exists with this user
      if (!isGroup && selectedUsers.length === 1) {
        const { data: existingConversations } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", user.id);

        if (existingConversations) {
          for (const conv of existingConversations) {
            const { data: otherParticipants } = await supabase
              .from("conversation_participants")
              .select("user_id")
              .eq("conversation_id", conv.conversation_id)
              .neq("user_id", user.id);

            const { data: convData } = await supabase
              .from("conversations")
              .select("is_group")
              .eq("id", conv.conversation_id)
              .single();

            if (
              otherParticipants?.length === 1 &&
              otherParticipants[0].user_id === selectedUsers[0] &&
              !convData?.is_group
            ) {
              onConversationCreated(conv.conversation_id);
              onOpenChange(false);
              resetForm();
              return;
            }
          }
        }
      }

      // Create new conversation
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          company_id: companyId,
          created_by: user.id,
          is_group: isGroup,
          name: isGroup ? groupName : null,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add participants including current user
      const participants = [user.id, ...selectedUsers].map((userId) => ({
        conversation_id: conversation.id,
        user_id: userId,
      }));

      const { error: partError } = await supabase.from("conversation_participants").insert(participants);

      if (partError) throw partError;

      toast.success(isGroup ? "Group created" : "Conversation started");
      onConversationCreated(conversation.id);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast.error("Failed to create conversation");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIsGroup(false);
    setGroupName("");
    setSelectedUsers([]);
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 px-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="is-group" checked={isGroup} onCheckedChange={(checked) => setIsGroup(checked === true)} />
            <Label htmlFor="is-group">Create group chat</Label>
          </div>

          {isGroup && (
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Select {isGroup ? "participants" : "user"}</Label>
            <SearchableSelect
              options={profiles.map((p) => ({
                value: p.user_id,
                label: `${p.first_name} ${p.last_name}`,
              }))}
              value={isGroup ? "" : selectedUsers[0] || ""}
              onValueChange={(val) => {
                if (!val) return;
                if (isGroup) {
                  if (!selectedUsers.includes(val)) {
                    setSelectedUsers((prev) => [...prev, val]);
                  }
                } else {
                  setSelectedUsers([val]);
                }
              }}
              placeholder="Search users..."
              emptyMessage="No users found"
            />
            {isGroup && selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {selectedUsers.map((uid) => {
                  const p = profiles.find((pr) => pr.user_id === uid);
                  return (
                    <Badge key={uid} variant="secondary" className="gap-1">
                      {p ? `${p.first_name} ${p.last_name}` : uid}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => setSelectedUsers((prev) => prev.filter((id) => id !== uid))}
                      />
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleCreate} disabled={loading || selectedUsers.length === 0}>
            {loading ? "Creating..." : "Start Chat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
