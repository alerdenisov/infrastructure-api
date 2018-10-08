import { NestFactory } from '@nestjs/core';
import { AppModule } from 'app.module';
import { run as eth } from 'eth/app';
import config from 'config';

async function server() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(`/api/v${config.version}`);
  await app.listen(config.port, config.host);
}

const apps = {
  eth,
  server,
};

type Apps = keyof typeof apps;

async function bootstrap() {
  const argv = process.argv.slice(2);
  if (argv.length && Object.keys(apps).indexOf(argv[0]) !== -1) {
    const app = <Apps>argv[0];
    await apps[app]();
  } else if (argv.length == 0) {
    const all = Object.keys(apps).map(key => apps[key]);
    await Promise.all(all.map(f => f()));
  } else {
    console.log(`Unknown arguments: ${argv}`);
  }
}
bootstrap();
