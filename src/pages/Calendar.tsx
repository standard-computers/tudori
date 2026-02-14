import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStatusBar } from "@/contexts/StatusBarContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import {
  Plus, ChevronLeft, ChevronRight, ArrowLeft,
  Globe, Maximize2, Minimize2, Trash2, RefreshCw
} from "lucide-react";
import { toast } from "@/lib/toast";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, addWeeks, subWeeks,
  isSameMonth, isSameDay, isToday, parseISO, setHours, setMinutes,
  startOfDay, endOfDay
} from "date-fns";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  all_day: boolean;
  scope: string;
  color: string;
  location_id: string | null;
  created_by: string;
  company_id: string;
  location?: { name: string } | null;
}

interface TaskEvent {
  id: string;
  title: string;
  due_date: string;
  status: string;
  priority: string;
}

interface Location {
  id: string;
  name: string;
  location_id: string;
}

type ViewMode = "month" | "week";

const EVENT_COLORS = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#ef4444", label: "Red" },
  { value: "#22c55e", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#f97316", label: "Orange" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const CalendarPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { setTransaction } = useStatusBar();
  const navigate = useNavigate();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskEvent[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showTasks, setShowTasks] = useState(true);

  const defaultFormData = {
    title: "",
    description: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "09:00",
    end_date: format(new Date(), "yyyy-MM-dd"),
    end_time: "10:00",
    all_day: false,
    scope: "personal",
    color: "#3b82f6",
    location_id: "",
  };
  const [formData, setFormData] = useState(defaultFormData);

  useEffect(() => {
    setTransaction("CALENDAR");
  }, [setTransaction]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // Fetch company ID
  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.company_id) setCompanyId(data.company_id);
        });
    }
  }, [user]);

  const fetchEvents = useCallback(async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*, location:locations(name)")
      .eq("company_id", companyId)
      .order("start_date");

    if (!error) setEvents(data || []);
  }, [companyId]);

  const fetchTasks = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("tasks")
      .select("id, title, due_date, status, priority")
      .eq("company_id", companyId)
      .not("due_date", "is", null)
      .neq("status", "done");

    setTasks((data as TaskEvent[]) || []);
  }, [companyId]);

  const fetchLocations = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("locations")
      .select("id, name, location_id")
      .eq("company_id", companyId)
      .order("name");
    setLocations(data || []);
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      fetchEvents();
      fetchTasks();
      fetchLocations();
    }
  }, [companyId, fetchEvents, fetchTasks, fetchLocations]);

  useEffect(() => {
    setTransaction(`CALENDAR • ${format(currentDate, viewMode === "month" ? "MMMM yyyy" : "'Week of' MMM d, yyyy")}`);
  }, [currentDate, viewMode, setTransaction]);

  // Navigation
  const navigateBack = () => {
    setCurrentDate(prev => viewMode === "month" ? subMonths(prev, 1) : subWeeks(prev, 1));
  };
  const navigateForward = () => {
    setCurrentDate(prev => viewMode === "month" ? addMonths(prev, 1) : addWeeks(prev, 1));
  };
  const goToToday = () => setCurrentDate(new Date());

  // Calendar grid
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    const days: Date[] = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const getEventsForDay = useCallback((day: Date) => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);

    const calEvents = events.filter(e => {
      const eStart = parseISO(e.start_date);
      const eEnd = parseISO(e.end_date);
      return eStart <= dayEnd && eEnd >= dayStart;
    });

    const taskEvents = showTasks
      ? tasks.filter(t => t.due_date && isSameDay(parseISO(t.due_date), day))
      : [];

    return { calEvents, taskEvents };
  }, [events, tasks, showTasks]);

  // Event dialog
  const openNewEvent = useCallback((day?: Date) => {
    const d = day || new Date();
    setEditingEvent(null);
    setFormData({
      ...defaultFormData,
      start_date: format(d, "yyyy-MM-dd"),
      end_date: format(d, "yyyy-MM-dd"),
    });
    setIsDialogOpen(true);
  }, []);

  const openEditEvent = useCallback((event: CalendarEvent) => {
    if (event.created_by !== user?.id) {
      toast.error("You can only edit your own events");
      return;
    }
    setEditingEvent(event);
    const start = parseISO(event.start_date);
    const end = parseISO(event.end_date);
    setFormData({
      title: event.title,
      description: event.description || "",
      start_date: format(start, "yyyy-MM-dd"),
      start_time: format(start, "HH:mm"),
      end_date: format(end, "yyyy-MM-dd"),
      end_time: format(end, "HH:mm"),
      all_day: event.all_day,
      scope: event.scope,
      color: event.color,
      location_id: event.location_id || "",
    });
    setIsDialogOpen(true);
  }, [user?.id]);

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("Please enter an event title");
      return;
    }
    if (!companyId || !user) return;

    const startDateTime = formData.all_day
      ? `${formData.start_date}T00:00:00`
      : `${formData.start_date}T${formData.start_time}:00`;
    const endDateTime = formData.all_day
      ? `${formData.end_date}T23:59:59`
      : `${formData.end_date}T${formData.end_time}:00`;

    const payload = {
      title: formData.title.trim(),
      description: formData.description || null,
      start_date: startDateTime,
      end_date: endDateTime,
      all_day: formData.all_day,
      scope: formData.scope,
      color: formData.color,
      location_id: formData.location_id || null,
      company_id: companyId,
      created_by: user.id,
    };

    if (editingEvent) {
      const { error } = await supabase
        .from("calendar_events")
        .update(payload)
        .eq("id", editingEvent.id);
      if (error) {
        toast.error("Failed to update event");
        return;
      }
      toast.success("Event updated");
    } else {
      const { error } = await supabase
        .from("calendar_events")
        .insert(payload);
      if (error) {
        toast.error("Failed to create event");
        return;
      }
      toast.success("Event created");
    }

    setIsDialogOpen(false);
    fetchEvents();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", deleteId);
    if (error) {
      toast.error("Failed to delete event");
    } else {
      toast.success("Event deleted");
      fetchEvents();
    }
    setDeleteId(null);
  };

  // Keyboard shortcut for new event
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
        e.preventDefault();
        openNewEvent();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openNewEvent]);

  // Ctrl+S save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && isDialogOpen) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDialogOpen, formData, editingEvent, companyId, user]);

  if (authLoading) return null;

  return (
    <div>
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">Calendar</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
            <div className="flex items-center border rounded-md">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateBack}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 text-sm font-medium min-w-[160px] text-center">
                {format(currentDate, viewMode === "month" ? "MMMM yyyy" : "MMM d, yyyy")}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateForward}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === "month" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode("month")}
              >
                Month
              </Button>
              <Button
                variant={viewMode === "week" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode("week")}
              >
                Week
              </Button>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <Label htmlFor="show-tasks" className="text-xs text-muted-foreground">Tasks</Label>
              <Switch id="show-tasks" checked={showTasks} onCheckedChange={setShowTasks} />
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { fetchEvents(); fetchTasks(); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => openNewEvent()}>
              <Plus className="mr-1 h-4 w-4" />
              New Event
              <Kbd className="ml-2">N</Kbd>
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4">
        {viewMode === "month" ? (
          <MonthView
            days={monthDays}
            currentDate={currentDate}
            getEventsForDay={getEventsForDay}
            onDayClick={openNewEvent}
            onEventClick={openEditEvent}
          />
        ) : (
          <WeekView
            days={weekDays}
            getEventsForDay={getEventsForDay}
            onTimeClick={(day) => openNewEvent(day)}
            onEventClick={openEditEvent}
          />
        )}
      </main>

      {/* Event Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={isMaximized ? "!max-w-full !h-full !rounded-none !m-0" : "max-w-lg"}>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-10 top-4 h-6 w-6"
            onClick={() => setIsMaximized(!isMaximized)}
          >
            {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Edit Event" : "New Event"}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Event title..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-desc">Description</Label>
              <Textarea
                id="event-desc"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description..."
                rows={2}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.all_day}
                onCheckedChange={v => setFormData(prev => ({ ...prev, all_day: v }))}
              />
              <Label>All day</Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              {!formData.all_day && (
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={formData.start_time}
                    onChange={e => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
              {!formData.all_day && (
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={formData.end_time}
                    onChange={e => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select value={formData.scope} onValueChange={v => setFormData(prev => ({ ...prev, scope: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="company">Company-wide</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Select
                  value={formData.location_id || "__none__"}
                  onValueChange={v => setFormData(prev => ({ ...prev, location_id: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {EVENT_COLORS.map(c => (
                  <button
                    key={c.value}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      formData.color === c.value ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setFormData(prev => ({ ...prev, color: c.value }))}
                    title={c.label}
                    type="button"
                  />
                ))}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            {editingEvent && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => { setIsDialogOpen(false); setDeleteId(editingEvent.id); }}
                className="mr-auto"
              >
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </Button>
            )}
            <Button onClick={handleSave}>
              {editingEvent ? "Save Changes" : "Create Event"}
              <Kbd className="ml-2">⌘S</Kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={open => { if (!open) setDeleteId(null); }}
        onConfirm={handleDelete}
        title="Delete Event"
        description="Are you sure you want to delete this event? This action cannot be undone."
      />
    </div>
  );
};

// Month View Component
const MonthView = ({
  days,
  currentDate,
  getEventsForDay,
  onDayClick,
  onEventClick,
}: {
  days: Date[];
  currentDate: Date;
  getEventsForDay: (day: Date) => { calEvents: CalendarEvent[]; taskEvents: TaskEvent[] };
  onDayClick: (day: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}) => {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 bg-muted/50">
        {dayNames.map(d => (
          <div key={d} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground border-b">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-[120px]">
        {days.map((day, i) => {
          const { calEvents, taskEvents } = getEventsForDay(day);
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <div
              key={i}
              className={`border-b border-r p-1 cursor-pointer hover:bg-muted/30 transition-colors ${
                !inMonth ? "bg-muted/20 text-muted-foreground" : ""
              }`}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("[data-event]")) return;
                onDayClick(day);
              }}
            >
              <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                today ? "bg-primary text-primary-foreground" : ""
              }`}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5 overflow-hidden">
                {calEvents.slice(0, 3).map(event => (
                  <div
                    key={event.id}
                    data-event="true"
                    className="text-[10px] leading-tight px-1 py-0.5 rounded truncate text-white cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: event.color || "#3b82f6" }}
                    onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                    title={event.title}
                  >
                    {!event.all_day && (
                      <span className="opacity-75">{format(parseISO(event.start_date), "h:mm")} </span>
                    )}
                    {event.scope === "company" && <Globe className="inline h-2.5 w-2.5 mr-0.5" />}
                    {event.title}
                  </div>
                ))}
                {taskEvents.slice(0, 2).map(task => (
                  <div
                    key={task.id}
                    data-event="true"
                    className="text-[10px] leading-tight px-1 py-0.5 rounded truncate bg-destructive/15 text-destructive border border-destructive/20"
                    title={`Task: ${task.title}`}
                  >
                    ✓ {task.title}
                  </div>
                ))}
                {(calEvents.length + taskEvents.length) > 4 && (
                  <div className="text-[10px] text-muted-foreground px-1">
                    +{calEvents.length + taskEvents.length - 4} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Week View Component
const WeekView = ({
  days,
  getEventsForDay,
  onTimeClick,
  onEventClick,
}: {
  days: Date[];
  getEventsForDay: (day: Date) => { calEvents: CalendarEvent[]; taskEvents: TaskEvent[] };
  onTimeClick: (day: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}) => {
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] bg-muted/50 border-b">
        <div className="p-2" />
        {days.map((day, i) => {
          const { calEvents, taskEvents } = getEventsForDay(day);
          const allDay = calEvents.filter(e => e.all_day);
          return (
            <div key={i} className="p-2 text-center border-l">
              <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
              <div className={`text-lg font-semibold w-9 h-9 flex items-center justify-center rounded-full mx-auto ${
                isToday(day) ? "bg-primary text-primary-foreground" : ""
              }`}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5 mt-1">
                {allDay.map(event => (
                  <div
                    key={event.id}
                    className="text-[10px] px-1 py-0.5 rounded truncate text-white cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: event.color || "#3b82f6" }}
                    onClick={() => onEventClick(event)}
                  >
                    {event.title}
                  </div>
                ))}
                {taskEvents.map(task => (
                  <div
                    key={task.id}
                    className="text-[10px] px-1 py-0.5 rounded truncate bg-destructive/15 text-destructive"
                  >
                    ✓ {task.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="max-h-[600px] overflow-y-auto">
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          {HOURS.map(hour => (
            <div key={hour} className="contents">
              <div className="h-12 border-b px-2 text-[10px] text-muted-foreground flex items-start pt-1 justify-end pr-2">
                {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
              </div>
              {days.map((day, dayIdx) => {
                const { calEvents } = getEventsForDay(day);
                const hourEvents = calEvents.filter(e => {
                  if (e.all_day) return false;
                  const eHour = parseISO(e.start_date).getHours();
                  return eHour === hour;
                });

                return (
                  <div
                    key={dayIdx}
                    className="h-12 border-b border-l relative cursor-pointer hover:bg-muted/20"
                    onClick={() => {
                      const d = setMinutes(setHours(day, hour), 0);
                      onTimeClick(d);
                    }}
                  >
                    {hourEvents.map(event => (
                      <div
                        key={event.id}
                        className="absolute inset-x-0.5 top-0.5 text-[10px] px-1 py-0.5 rounded text-white cursor-pointer hover:opacity-80 truncate z-10"
                        style={{ backgroundColor: event.color || "#3b82f6" }}
                        onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                      >
                        {format(parseISO(event.start_date), "h:mm")} {event.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
