import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { parseId } from '../../utils/parseId';
import * as service from './admin.service';

const statusQuery = z.enum(['pending', 'verified', 'rejected']).default('pending');

export const listEmployers = asyncHandler(async (req: Request, res: Response) => {
  const status = statusQuery.parse(req.query.status);
  res.json(await service.listEmployers(status));
});

export const verifyEmployer = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.setVerification(parseId(req.params.id), 'verified'));
});

export const rejectEmployer = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.setVerification(parseId(req.params.id), 'rejected'));
});
