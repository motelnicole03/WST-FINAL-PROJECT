import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { optionalAuthenticate } from '../../middleware/optionalAuthenticate';
import { validateBody } from '../../middleware/validate';
import * as controller from './opportunities.controller';
import { createOpportunitySchema, updateOpportunitySchema } from './opportunities.schema';

const router = Router();

const employerOnly = [authenticate, authorize('employer')];
const adminOnly = [authenticate, authorize('admin')];
const studentOnly = [authenticate, authorize('student')];

// Public: browse and search open opportunities
router.get('/', controller.list);

// Fixed paths must come before '/:id' so they are not read as an id
router.get('/mine', ...employerOnly, controller.mine);
router.get('/pending', ...adminOnly, controller.pending);
router.get('/saved', ...studentOnly, controller.saved);

// Employer: create and manage postings
router.post('/', ...employerOnly, validateBody(createOpportunitySchema), controller.create);
router.patch('/:id', ...employerOnly, validateBody(updateOpportunitySchema), controller.update);
router.post('/:id/submit', ...employerOnly, controller.submit);
router.post('/:id/close', ...employerOnly, controller.close);

// Admin: moderate postings
router.post('/:id/approve', ...adminOnly, controller.approve);
router.post('/:id/reject', ...adminOnly, controller.reject);

// Student: bookmarks
router.post('/:id/save', ...studentOnly, controller.save);
router.delete('/:id/save', ...studentOnly, controller.unsave);

// Public detail; owners and admins can also see non-public ones
router.get('/:id', optionalAuthenticate, controller.getOne);

export default router;
