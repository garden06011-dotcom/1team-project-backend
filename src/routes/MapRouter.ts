import { Router } from 'express';
import {user_request_save, getLocationDate, getLocationCenter, getDongPolygon, getDistrictPolygons, getPopulationData, getTimeDayData, getSubdistrictRankings}  from '../controllers/MapController';


const router = Router();

router.post('/save', user_request_save);
router.get('/location', getLocationDate);
router.post('/location-center', getLocationCenter);
router.post("/dong-polygon", getDongPolygon);
router.post("/district-polygons", getDistrictPolygons);
router.post("/population-data", getPopulationData);
router.post("/time-day-data", getTimeDayData);
router.get("/subdistrict-rankings", getSubdistrictRankings);

export default router;