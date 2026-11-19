import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './admin.controller';

const router = Router();

// Everything under /api/admin is admin-only
router.use(authenticate, authorize('admin'));

router.get('/employers', controller.listEmployers); // ?status=pending|verified|rejected
router.post('/employers/:id/verify', controller.verifyEmployer);
router.post('/employers/:id/reject', controller.rejectEmployer);

export default router;
