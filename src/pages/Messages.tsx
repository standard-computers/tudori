import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Plus, Send, Users, User } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { NewConversationDialog } from "@/components/messages/NewConversationDialog";
import { format, isToday, isYesterday } from "date-fns";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  updated_at: string;
  participants: { user_id: string; first_name: string; last_name: string }[];
  lastMessage?: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  sender?: { first_name: string; last_name: string };
}

const Messages = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // F1 to go back
  useKeyboardShortcut('F1', () => navigate(-1));
  useKeyboardShortcut('n', () => setShowNewDialog(true));

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      
      const channel = supabase
        .channel(`messages:${selectedConversation.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${selectedConversation.id}`,
          },
          async (payload) => {
            const newMsg = payload.new as Message;
            // Fetch sender info
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("user_id", newMsg.sender_id)
              .single();
            
            setMessages((prev) => [
              ...prev,
              { ...newMsg, sender: profile || undefined },
            ]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchConversations = async () => {
    if (!user) return;

    const { data: participantData } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (!participantData || participantData.length === 0) return;

    const conversationIds = participantData.map((p) => p.conversation_id);

    const { data: convData } = await supabase
      .from("conversations")
      .select("*")
      .in("id", conversationIds)
      .order("updated_at", { ascending: false });

    if (!convData) return;

    // Fetch participants and last message for each conversation
    const conversationsWithDetails = await Promise.all(
      convData.map(async (conv) => {
        const { data: participants } = await supabase
          .from("conversation_participants")
          .select("user_id")
          .eq("conversation_id", conv.id);

        const participantProfiles = await Promise.all(
          (participants || []).map(async (p) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("user_id", p.user_id)
              .single();
            return { user_id: p.user_id, ...profile };
          })
        );

        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        return {
          ...conv,
          participants: participantProfiles.filter((p) => p.first_name),
          lastMessage: lastMsg?.content,
        };
      })
    );

    setConversations(conversationsWithDetails as Conversation[]);
  };

  const fetchMessages = async (conversationId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!data) return;

    // Fetch sender profiles
    const messagesWithSenders = await Promise.all(
      data.map(async (msg) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", msg.sender_id)
          .single();
        return { ...msg, sender: profile || undefined };
      })
    );

    setMessages(messagesWithSenders);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    setSendingMessage(true);
    try {
      await supabase.from("messages").insert({
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        content: newMessage.trim(),
      });

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedConversation.id);

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSendingMessage(false);
    }
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.is_group && conv.name) return conv.name;
    const otherParticipants = conv.participants.filter((p) => p.user_id !== user?.id);
    if (otherParticipants.length === 0) return "Just you";
    return otherParticipants.map((p) => `${p.first_name} ${p.last_name}`).join(", ");
  };

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, "h:mm a");
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMM d");
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = "";

    msgs.forEach((msg) => {
      const msgDate = format(new Date(msg.created_at), "yyyy-MM-dd");
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  const formatGroupDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMMM d, yyyy");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Messages</h1>
          </div>
          <Button size="sm" onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New
            <Kbd>N</Kbd>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`w-full md:w-80 border-r flex flex-col ${selectedConversation ? "hidden md:flex" : ""}`}>
          <ScrollArea className="flex-1">
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <p>No conversations yet</p>
                <Button variant="link" onClick={() => setShowNewDialog(true)}>
                  Start a new conversation
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`p-3 cursor-pointer hover:bg-accent transition-colors ${
                      selectedConversation?.id === conv.id ? "bg-accent" : ""
                    }`}
                    onClick={() => setSelectedConversation(conv)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10">
                          {conv.is_group ? <Users className="h-5 w-5" /> : <User className="h-5 w-5" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate">{getConversationName(conv)}</p>
                          <span className="text-xs text-muted-foreground">
                            {formatMessageDate(conv.updated_at)}
                          </span>
                        </div>
                        {conv.lastMessage && (
                          <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className={`flex-1 flex flex-col ${!selectedConversation ? "hidden md:flex" : ""}`}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="border-b p-3 flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10">
                    {selectedConversation.is_group ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{getConversationName(selectedConversation)}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation.participants.length} participant
                    {selectedConversation.participants.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {groupMessagesByDate(messages).map((group) => (
                  <div key={group.date}>
                    <div className="flex items-center justify-center my-4">
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        {formatGroupDate(group.date)}
                      </span>
                    </div>
                    {group.messages.map((msg) => {
                      const isOwn = msg.sender_id === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex mb-2 ${isOwn ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg px-3 py-2 ${
                              isOwn
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            {!isOwn && selectedConversation.is_group && msg.sender && (
                              <p className="text-xs font-medium mb-1">
                                {msg.sender.first_name} {msg.sender.last_name}
                              </p>
                            )}
                            <p className="text-sm">{msg.content}</p>
                            <p
                              className={`text-xs mt-1 ${
                                isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                              }`}
                            >
                              {format(new Date(msg.created_at), "h:mm a")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </ScrollArea>

              {/* Input */}
              <div className="border-t p-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={sendingMessage || !newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a conversation or start a new one
            </div>
          )}
        </div>
      </div>

      <NewConversationDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onConversationCreated={(id) => {
          fetchConversations();
          const conv = conversations.find((c) => c.id === id);
          if (conv) setSelectedConversation(conv);
        }}
      />
    </div>
  );
};

export default Messages;
