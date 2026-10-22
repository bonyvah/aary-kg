/** A group of students (a class). Admins manage them; a student is in exactly one. */
export type Group = {
  id: string;
  name: string;
  studentCount: number;
  /** ISO date the group was created. */
  createdAt: string;
};
