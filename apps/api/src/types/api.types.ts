import { Request, Response, NextFunction } from 'express';

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

export interface RequestContext {
  requestId: string;
  ip: string;
  userAgent?: string;
  startTime: number;
}
