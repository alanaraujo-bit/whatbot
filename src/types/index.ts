import type {
  Automation,
  Contact,
  Conversation,
  CrmStage,
  Message,
  Note,
  SessionStatus,
  Tag,
} from "@prisma/client";

/**
 * Tipos das respostas da API, compartilhados pelos componentes cliente.
 *
 * Derivam dos models do Prisma para que uma mudança no schema quebre a
 * compilação aqui em vez de virar bug em runtime. Datas chegam como string
 * (JSON) e são convertidas na hora de formatar.
 */

export type TagSummary = Pick<Tag, "id" | "name" | "color">;

export type ContactSummary = Pick<
  Contact,
  "id" | "name" | "phone" | "avatarUrl" | "stage"
> & {
  tags: TagSummary[];
};

export type ConversationListItem = Omit<Conversation, "lastMessageAt" | "createdAt" | "updatedAt"> & {
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  contact: ContactSummary;
  assignedTo: { id: string; name: string } | null;
};

export type MessageItem = Omit<Message, "timestamp" | "createdAt"> & {
  timestamp: string;
  createdAt: string;
  sentBy: { id: string; name: string } | null;
};

export type NoteItem = Omit<Note, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string } | null;
};

export type ConversationDetail = ConversationListItem & {
  contact: ContactSummary &
    Pick<Contact, "email" | "company" | "notes" | "createdAt"> & {
      internalNotes: NoteItem[];
    };
  messages: MessageItem[];
};

export type ContactListItem = Omit<Contact, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
  tags: TagSummary[];
  conversations: { id: string }[];
};

export type TagWithCount = Tag & { _count: { contacts: number } };

export type AutomationItem = Omit<Automation, "createdAt" | "updatedAt" | "lastTriggeredAt"> & {
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt: string | null;
};

export type WhatsappSessionState = {
  id: string;
  name: string;
  status: SessionStatus;
  qrCode: string | null;
  phoneNumber: string | null;
  profileName: string | null;
  lastError: string | null;
  lastConnectedAt: string | null;
};

export type WorkspaceStats = {
  stages: Partial<Record<CrmStage, number>>;
  openConversations: number;
  unread: number;
  totalContacts: number;
};
