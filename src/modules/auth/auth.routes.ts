import { Router } from 'express';
import { signupHandler, loginHandler } from './auth.controller';

export const authRouter = Router();
authRouter.post('/signup', signupHandler);
authRouter.post('/login', loginHandler);
