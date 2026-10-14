export type Role = 'super_admin' | 'admin' | 'officer' | 'viewer';
export type DocumentType = 'incoming' | 'outgoing' | 'internal';
export type Urgency = 'ปกติ' | 'ด่วน' | 'ด่วนมาก' | 'ด่วนที่สุด';
export type DocumentStatus = 'registered' | 'assigned' | 'in_progress' | 'completed' | 'archived' | 'closed';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  department: string;
  isActive: boolean;
  createdAt: any; // Firestore Timestamp
  updatedAt: any;
}

export interface DriveLink {
  title: string;
  url: string;
  description: string;
  created_by: string;
  created_at: any;
}

export interface SarabanDocument {
  id: string;
  running_number: string;
  document_type: DocumentType;
  document_number: string;
  document_date: any;
  received_date?: any;
  sent_date?: any;
  subject: string;
  description: string;
  sender: string;
  recipient: string;
  department: string;
  urgency: Urgency;
  confidentiality: string;
  responsible_user_id: string;
  status: DocumentStatus;
  notes: string;
  tracking_number?: string;
  courier?: string;
  drive_links: DriveLink[];
  archive_location_id: string;
  archive_location_code?: string;
  archive_cabinet?: string;
  archive_shelf?: string;
  archive_folder?: string;
  archive_folder_name?: string;
  related_documents: string[];
  created_by: string;
  updated_by: string;
  closed_at?: any;
  createdAt: any;
  updatedAt: any;
  deleted: boolean;
  deleted_at?: any;
  deleted_by?: string;
}

export interface PostalTracking {
  id: string;
  tracking_number: string;
  courier: string;
  source_type: 'outgoing_doc' | 'standalone';
  outgoing_doc_id?: string;
  outgoing_running_number?: string;
  subject: string;
  recipient_name: string;
  recipient_address?: string;
  sent_date: any;
  fee?: number;
  notes?: string;
  created_by: string;
  createdAt: any;
  updatedAt: any;
  deleted: boolean;
}

export interface ArchiveLocation {
  id: string;
  cabinet: string;
  shelf: string;
  category: string;
  folder: string;
  sequence: string;
  folder_name?: string;
  location_code: string;
  createdAt: any;
  updatedAt: any;
}

export interface SystemConfigs {
  id: 'running_numbers';
  current_year: number;
  incoming_last_number: number;
  outgoing_last_number: number;
  internal_last_number: number;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: 'document' | 'user' | 'archive_location';
  entity_id: string;
  previous_value?: Record<string, any>;
  new_value?: Record<string, any>;
  timestamp: any;
}
