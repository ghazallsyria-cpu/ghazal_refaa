import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getMessagesBetween, sendMessage, getTeachers, getStudents, getTeacherClasses, getStudentsByClass } from "@/lib/api";
import { toast } from "sonner";
import { Send, Users, BookOpen, Shield, UserCheck } from "lucide-react";

const SECTIONS = [
  { key: "students", label: "الطلاب", icon: Users },
  { key: "teachers", label: "المعلمون", icon: BookOpen },
  { key: "admin",    label: "الإدارة",  icon: Shield },
  { key: "parents",  label: "أولياء الأمور", icon: UserCheck },
] as const;

export default function Messages() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selUser, setSelUser] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [section, setSection] = useState<"students"|"teachers"|"admin"|"parents">("students");

  const { data: messages = [] } = useQuery({ queryKey:["messages",selUser?.id], queryFn:()=>getMessagesBetween(user!.id, selUser!.id), enabled:!!selUser&&!!user });
  const { data: allTeachers = [] } = useQuery({ queryKey:["teachers"], queryFn: getTeachers });
  const { data: allStudents = [] } = useQuery({ queryKey:["students"], queryFn: getStudents });
  const { data: tClasses = [] } = useQuery({ queryKey:["teacher-classes",user?.id], queryFn:()=>getTeacherClasses(user!.id), enabled:!!user&&user.role==="teacher" });

  const isTeacher = user?.role === "teacher";
  const teacherClassIds = new Set((tClasses as any[]).map((tc:any)=>tc.class_id));

  // For teacher: only students in their classes
  const myStudents = isTeacher ? (allStudents as any[]).filter(s=>teacherClassIds.has(s.class_id)) : allStudents as any[];
  // Teachers list (excluding self)
  const otherTeachers = (allTeachers as any[]).filter(t=>t.id!==user?.id);
  // Admins (users with role admin)
  const admins = (allTeachers as any[]).filter(t=>t.role==="admin");

  const sendMut = useMutation({
    mutationFn:()=>sendMessage({ sender_id:user!.id, receiver_id:selUser!.id, content:message }),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:["messages",selUser?.id]}); setMessage(""); },
    onError:()=>toast.error("خطأ في الإرسال")
  });

  const getContactList = () => {
    if (section==="students") return myStudents;
    if (section==="teachers") return otherTeachers;
    if (section==="admin") return (allTeachers as any[]).filter(t=>t.role==="admin"&&t.id!==user?.id);
    if (section==="parents") return []; // parents linked to teacher's students
    return [];
  };
  const contacts = getContactList();

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold">الرسائل</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)] min-h-96">
        {/* Sidebar */}
        <div className="bg-card rounded-xl border overflow-hidden flex flex-col">
          {/* Section tabs */}
          <div className="grid grid-cols-2 border-b">
            {SECTIONS.filter(s=>!isTeacher||s.key!=="admin"||true).map(({key,label,icon:Icon})=>(
              <button key={key} onClick={()=>{setSection(key);setSelUser(null);}}
                className={`flex items-center justify-center gap-1 py-2.5 text-xs font-heading border-b-2 transition-colors ${section===key?"border-primary text-primary bg-primary/5":"border-transparent text-muted-foreground hover:bg-accent"}`}>
                <Icon className="w-3.5 h-3.5"/>{label}
              </button>
            ))}
          </div>
          {/* Contact list */}
          <div className="flex-1 overflow-y-auto divide-y">
            {contacts.length===0&&<div className="text-center py-8 text-sm text-muted-foreground">لا يوجد جهات اتصال</div>}
            {contacts.map((c:any)=>(
              <button key={c.id} onClick={()=>setSelUser(c)}
                className={`w-full flex items-center gap-3 p-3 text-right hover:bg-accent transition-colors ${selUser?.id===c.id?"bg-primary/5 border-r-2 border-primary":""}`}>
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-heading font-bold text-primary text-sm shrink-0">{c.full_name?.[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.classes?.name||c.role==="admin"?"إدارة":""}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="lg:col-span-2 bg-card rounded-xl border flex flex-col overflow-hidden">
          {selUser ? (
            <>
              <div className="p-4 border-b flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-heading font-bold text-primary">{selUser.full_name?.[0]}</div>
                <div><p className="font-heading font-semibold text-sm">{selUser.full_name}</p><p className="text-xs text-muted-foreground">{selUser.classes?.name||""}</p></div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(messages as any[]).map((m:any)=>{
                  const isMine = m.sender_id===user?.id;
                  return (
                    <div key={m.id} className={`flex ${isMine?"justify-start":"justify-end"}`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${isMine?"bg-primary text-primary-foreground rounded-tr-sm":"bg-accent rounded-tl-sm"}`}>
                        <p>{m.content}</p>
                        <p className={`text-[10px] mt-1 ${isMine?"opacity-70":"text-muted-foreground"}`}>{new Date(m.created_at).toLocaleTimeString("ar",{hour:"2-digit",minute:"2-digit"})}</p>
                      </div>
                    </div>
                  );
                })}
                {messages.length===0&&<div className="text-center py-12 text-muted-foreground text-sm">ابدأ المحادثة</div>}
              </div>
              <div className="p-3 border-t flex gap-2">
                <input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&message.trim()&&sendMut.mutate()}
                  placeholder="اكتب رسالتك..." className="flex-1 px-4 py-2.5 bg-background border rounded-xl text-sm"/>
                <button onClick={()=>sendMut.mutate()} disabled={!message.trim()||sendMut.isPending}
                  className="p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90">
                  <Send className="w-4 h-4"/>
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-3">
              <Send className="w-12 h-12 opacity-20"/>
              <p className="text-sm">اختر جهة اتصال لبدء المحادثة</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
