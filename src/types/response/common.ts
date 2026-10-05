export type ApiResponse<T> = {
  data: T;
  error?: string;
  metadata?: MetaData;
};

export type MetaData = {
  total: number;
  page: number;
  pageSize: number;
};
