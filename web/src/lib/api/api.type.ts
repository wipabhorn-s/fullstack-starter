/** ต้องตรงกับ PUBLIC_USER_SELECT ใน api/src/users/users.service.ts */
export type Role = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED";

export type UserResponse = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
};

export type LoginResponse = {
  /** อายุสั้น (ประมาณ 15 นาที) proxy.ts ต่ออายุให้เองด้วย refresh_token */
  access_token: string;
  refresh_token: string;
  user: UserResponse;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
};
