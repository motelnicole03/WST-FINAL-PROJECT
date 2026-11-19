import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { parseId } from '../../utils/parseId';
import * as service from './opportunities.service';
import { listQuerySchema } from './opportunities.schema';

// Routes using these handlers sit behind authenticate, so req.user is set
// (except `list` and `getOne`, which are public).

export const list = asyncHandler(async (req: Request, res: Response) => {
  const filters = listQuerySchema.parse(req.query); // a ZodError becomes a 400
  res.json(await service.listOpen(filters));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.getOne(parseId(req.params.id), req.user));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await service.create(req.user!, req.body));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.update(req.user!, parseId(req.params.id), req.body));
});

export const submit = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.submit(req.user!, parseId(req.params.id)));
});

export const close = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.close(req.user!, parseId(req.params.id)));
});

export const mine = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.listMine(req.user!));
});

export const pending = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await service.listPending());
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.approve(req.user!, parseId(req.params.id)));
});

export const reject = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.reject(req.user!, parseId(req.params.id)));
});

export const saved = asyncHandler(async (req: Request, res: Response) => {
  res.json(await service.listSaved(req.user!));
});

export const save = asyncHandler(async (req: Request, res: Response) => {
  await service.saveForStudent(req.user!, parseId(req.params.id));
  res.status(204).end();
});

export const unsave = asyncHandler(async (req: Request, res: Response) => {
  await service.unsaveForStudent(req.user!, parseId(req.params.id));
  res.status(204).end();
});
