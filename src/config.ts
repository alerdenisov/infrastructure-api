import * as dotenv from 'dotenv';
import { important } from 'utils';

//load default environment variables
dotenv.config();

function assertEnv(key: string) {
  important(process.env[key], `Undefined environment variable ${key}`);
}

['HOST', 'PORT', 'VERSION'].forEach(key => assertEnv(key));

export default {
  host: process.env.HOST,
  port: process.env.PORT,
  version: process.env.VERSION,
};
