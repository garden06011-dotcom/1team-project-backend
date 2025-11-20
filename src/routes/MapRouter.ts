import { Router } from 'express';
import {custom_request}  from '../controllers/MapController';


const router = Router();

router.post('/save', custom_request);

export default router;