import Dexie, { type Table } from 'dexie';
import type { InterviewRecord } from './App';
import type { InterviewWriteInput } from './interviewsApi';

export interface PendingInterview {
  deviceUuid: string;
  enumeratorUsername: string;
  input: InterviewWriteInput;
  record: InterviewRecord;
  createdAt: string;
}

class OfflineInterviewsDatabase extends Dexie {
  pendingInterviews!: Table<PendingInterview, string>;

  constructor() {
    super('sies-offline-interviews');
    this.version(1).stores({ pendingInterviews: 'deviceUuid, enumeratorUsername, createdAt' });
  }
}

const database = new OfflineInterviewsDatabase();

export const savePendingInterview = (item: PendingInterview) => database.pendingInterviews.put(item);
export const getPendingInterviews = () => database.pendingInterviews.orderBy('createdAt').toArray();
export const removePendingInterview = (deviceUuid: string) => database.pendingInterviews.delete(deviceUuid);
