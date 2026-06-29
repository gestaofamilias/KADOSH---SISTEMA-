export interface Musician {
  id: string;
  name: string;
  role: "Vocal" | "Instrumento" | "Técnico de som" | "Datashow";
  instrument: string; // e.g. Soprano, Contrabaixo, Teclado, Mesa de Som, Projeção de Slides
  active: boolean;
  scaleCount: number;
  gender: "M" | "F";
  phone?: string;
  photo?: string;
  /** Data de nascimento (YYYY-MM-DD), usada para lembretes de aniversário. */
  birthday?: string;
  /** Outras funções que esta pessoa também exerce (ex: canta E toca instrumento). */
  secondaryRoles?: Array<"Vocal" | "Instrumento" | "Técnico de som" | "Datashow">;
  /** Voz/instrumento usado quando ela é escalada por uma das funções secundárias. */
  secondaryInstrument?: string;
  /** Outros instrumentos/funções que ela também toca dentro da MESMA função principal (ex: toca Teclado E Violão). */
  otherInstruments?: string[];
}

export interface Song {
  id: string;
  title: string;
  author: string;
  tone: string;
  bpm: number;
  theme: string;
  count: number;
  link?: string;
  timeSignature?: string;
  difficulty?: "Fácil" | "Média" | "Difícil";
}

export interface ScheduleMusicianRef {
  id: string;
  name: string;
  instrument: string;
  status: "Pendente" | "Confirmado" | "Recusado";
}

export interface ScheduleSongRef {
  id: string;
  title: string;
  tone: string;
  order: number;
}

export interface Schedule {
  id?: string;
  date: string;
  time?: string;
  title: string;
  theme: string;
  coordinator: string;
  status: "Rascunho" | "Aprovado";
  vocals: ScheduleMusicianRef[];
  instrumentalists: ScheduleMusicianRef[];
  technicians: ScheduleMusicianRef[];
  songs: ScheduleSongRef[];
  notes?: string;
  aiGenerated?: boolean;
}

export interface AIAnalysis {
  ausenciaVozes: string;
  ausenciaInstrumentos: string;
  balanceamentoMembros: string;
  analiseRepertorio: string;
  pontuacaoSeguranca: number;
  conselhosProcuctor: string;
}

export interface AISuggestedSong {
  title: string;
  author: string;
  idealTone: string;
  liturgicalMoment: string;
  spiritConnection: string;
  bpm: number;
}

export interface OllamaModelInfo {
  name: string;
  size: number;
  modified_at: string;
}

export interface OllamaRunningModelInfo {
  name: string;
  size: number;
  size_vram: number;
}

export interface AISettings {
  provider: "ollama" | "gemini";
  geminiConfigured: boolean;
  ollama: {
    baseUrl: string;
    connected: boolean;
    models: OllamaModelInfo[];
    currentModel: string | null;
    running: OllamaRunningModelInfo[];
  };
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface N8nSettings {
  webhookUrl: string;
}

export interface AutomationLog {
  id: string;
  scheduleId: string | null;
  automationType: "n8n_webhook" | "n8n_webhook_technical";
  webhookUrl: string | null;
  status: "Pendente" | "Enviado" | "Erro";
  response: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface ConfirmationLog {
  id: string;
  scheduleId: string;
  memberId: string;
  phone: string | null;
  messageSent: string | null;
  confirmationStatus: "Pendente" | "Confirmado" | "Recusado";
  responseText: string | null;
  sentAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  // Campos auxiliares já resolvidos pelo servidor para a tela de Automações
  memberName?: string;
  scheduleTitle?: string;
  scheduleDate?: string;
}

export interface AppNotification {
  id: string;
  date: string;
  type: "publish" | "added" | "general" | "reminder" | "birthday";
  title: string;
  message: string;
  targetMusicianId: string | "all";
  read: boolean;
}

export function getMusicianAvatar(name: string, gender: "M" | "F"): string {
  const maleAvatars = [
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150&h=150",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150&h=150",
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=150&h=150",
    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=150&h=150",
    "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=150&h=150",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=150&h=150"
  ];

  const femaleAvatars = [
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150&h=150",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=150&h=150",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150&h=150",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=150&h=150",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=150&h=150",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=150&h=150"
  ];

  const array = gender === "F" ? femaleAvatars : maleAvatars;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % array.length;
  return array[index];
}

