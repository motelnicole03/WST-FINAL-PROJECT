import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as service from './auth.service';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.register(req.body);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.login(req.body);
  res.json(result);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  // authenticate middleware guarantees req.user
  const user = await service.getCurrentUser(req.user!.userId);
  res.json(user);
});
