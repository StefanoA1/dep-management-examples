/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable unicorn/consistent-function-scoping */
import {Either, right} from 'fp-ts/lib/Either';
import {defaultDbService} from '../../src/default-services';
import {ILogger, IEmailService, IServices, EmailError} from '../../src/infra-types';

export const globalLogger: ILogger = {
  Info: () => {},
  Error: () => {}
};

export const defaultEmailService: IEmailService = {
  SendChangeNotification: () => (): Promise<Either<EmailError, null>> =>
    Promise.resolve(right(null))
};

export const createTestServices = (services: Partial<IServices>): IServices => {
  return {
    dbService: services.dbService ? services.dbService : defaultDbService,
    emailService: services.emailService ? services.emailService : defaultEmailService,
    logger: services.logger ? services.logger : globalLogger
  };
};
