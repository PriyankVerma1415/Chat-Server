import { format } from "date-fns";
import { Check, CheckCheck, FileText, Download, ChevronDown, Trash, Edit2, Reply, Video, Image as ImageIcon } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/useAuthStore";

export default function MessageBubble({ message, isOwn, isGroup }: { message: any; isOwn: boolean; isGroup?: boolean }) {
  const { deleteMessage, activeUser, setEditingMessage, setReplyingToMessage } = useChatStore();
  const { user } = useAuthStore();
  const isMedia = message.messageType && message.messageType !== 'text';
  const canDelete = isOwn && !message.isDeleted;
  const canEdit = isOwn && (!message.messageType || message.messageType === 'text') && !message.isDeleted && (Date.now() - new Date(message.createdAt).getTime() <= 5 * 60 * 1000);

  if (!message.message && !message.mediaUrl) return null;

  const renderReplyPreview = () => {
    if (!message.replyTo) return null;
    const isReplyOwn = message.replyTo.senderId?._id === activeUser?._id;
    return (
      <div className={`mb-2 p-2 rounded-lg text-xs border-l-4 ${isOwn ? 'bg-primary/20 border-primary-foreground/50' : 'bg-background/40 border-primary/50'} flex flex-col gap-1 cursor-pointer hover:opacity-80 transition-opacity`} onClick={() => {
        // Optional: scroll to message logic can go here
      }}>
        <span className="font-semibold opacity-80">{isReplyOwn ? activeUser?.username : 'You'}</span>
        <div className="flex items-center gap-2 opacity-90 truncate max-w-[200px]">
          {message.replyTo.messageType === 'image' && <ImageIcon className="w-3 h-3" />}
          {message.replyTo.messageType === 'video' && <Video className="w-3 h-3" />}
          {message.replyTo.messageType === 'document' && <FileText className="w-3 h-3" />}
          <span className="truncate">{message.replyTo.message || 'Media'}</span>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col mb-4 ${isOwn ? "items-end" : "items-start"}`}>
      <div className={`flex items-end gap-2 max-w-[75%] ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
        {!isOwn && isGroup && (
          <Avatar className="w-8 h-8 mb-1 shrink-0">
            <AvatarImage src={message.senderId?.avatar || undefined} />
            <AvatarFallback className="text-xs">{(message.senderId?.username || message.senderId?.phoneNumber || '?').charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        )}
        <div
          className={`group relative rounded-2xl ${isMedia ? 'p-1' : 'px-4 py-2'} ${
            isOwn
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-secondary text-secondary-foreground rounded-tl-sm"
          } ${isOwn && !isMedia ? 'pr-8' : ''}`}
        >
          {!isOwn && isGroup && (
            <p className="text-xs font-semibold text-primary mb-1">{message.senderId?.username || message.senderId?.phoneNumber}</p>
          )}
        <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center justify-center bg-black/10 text-current hover:bg-black/20 rounded-full h-5 w-5 outline-none backdrop-blur-sm">
              <ChevronDown className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isOwn ? "end" : "start"} sideOffset={5} className="w-32">
              <DropdownMenuItem 
                onClick={() => setReplyingToMessage(message)} 
                className="gap-2 cursor-pointer"
              >
                <Reply className="w-4 h-4" />
                <span>Reply</span>
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem 
                  onClick={() => setEditingMessage(message)} 
                  className="gap-2 cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit</span>
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem 
                  onClick={() => deleteMessage(message._id, undefined, isGroup ? message.groupId : undefined)} 
                  className="gap-2 cursor-pointer text-red-500 hover:text-red-600 focus:text-red-600"
                >
                  <Trash className="w-4 h-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {renderReplyPreview()}
        {(!message.messageType || message.messageType === 'text') && (
          <p className="text-sm">{message.message}</p>
        )}
        
        {message.messageType === 'image' && message.mediaUrl && (
          <img src={message.mediaUrl} alt="Attached image" className="rounded-xl max-w-full sm:max-w-[300px] object-cover" />
        )}
        
        {message.messageType === 'video' && message.mediaUrl && (
          <video src={message.mediaUrl} controls className="rounded-xl max-w-full sm:max-w-[300px]" />
        )}
        
        {(message.messageType === 'voice' || message.messageType === 'audio') && message.mediaUrl && (
          <div className="p-2">
            <audio src={message.mediaUrl} controls className="h-10 w-[200px] sm:w-[250px]" />
          </div>
        )}
        
        {message.messageType === 'document' && message.mediaUrl && (
          <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-background/10 rounded-xl hover:bg-background/20 transition">
            <div className="bg-background/20 p-2 rounded-lg">
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex flex-col overflow-hidden max-w-[150px]">
              <span className="text-sm font-medium truncate">{message.fileName || "Document"}</span>
              {message.fileSize && <span className="text-[10px] opacity-70">{(message.fileSize / 1024 / 1024).toFixed(2)} MB</span>}
            </div>
            <Download className="w-4 h-4 ml-2 opacity-70" />
          </a>
        )}
        
        {message.message && isMedia && (
          <p className="text-sm px-3 pb-2 pt-1">{message.message}</p>
        )}
        </div>
      </div>
      <div className={`flex items-center text-[10px] text-muted-foreground mt-1 mx-1 gap-1 flex-row ${isGroup && !isOwn ? 'ml-11' : ''}`}>
        <span>{message.createdAt ? format(new Date(message.createdAt), "HH:mm") : ""}</span>
        {message.isEdited && <span className="opacity-70 italic">(edited)</span>}
        {isOwn && (
          <span className="flex items-center">
            {(!message.status || message.status === 'sent') && <Check className="w-3.5 h-3.5" />}
            {message.status === 'delivered' && <CheckCheck className="w-3.5 h-3.5" />}
            {message.status === 'read' && <CheckCheck className="w-3.5 h-3.5 text-blue-500" />}
          </span>
        )}
      </div>
      {isGroup && message.seenBy && message.seenBy.length > 0 && (
        <div className={`flex items-center mt-0.5 ${isOwn ? 'mr-1 justify-end' : 'ml-11 justify-start'}`}>
          <div className="flex -space-x-1.5">
            {message.seenBy
              .filter((u: any) => u._id !== user?._id)
              .slice(0, 3)
              .map((u: any, index: number) => (
                <Avatar key={`${u._id || 'user'}-${index}`} className="w-4 h-4 border border-background shadow-sm ring-1 ring-background/10">
                  <AvatarImage src={u.avatar || undefined} />
                  <AvatarFallback className="text-[8px]">{(u.username || u.phoneNumber || '?').charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
            ))}
            {message.seenBy.filter((u: any) => u._id !== user?._id).length > 3 && (
              <div className="w-4 h-4 rounded-full bg-secondary text-foreground text-[8px] font-medium flex items-center justify-center border border-background shadow-sm z-10">
                +{message.seenBy.filter((u: any) => u._id !== user?._id).length - 3}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
