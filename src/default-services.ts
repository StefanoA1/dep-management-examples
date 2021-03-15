/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable unicorn/consistent-function-scoping */
/* eslint-disable @typescript-eslint/no-empty-function */
import {Either, right} from 'fp-ts/lib/Either';
import {UserId, Profile} from './business-types';
import {
  IDbService,
  DbConnection,
  SmtpCredentials,
  ILogger,
  IEmailService,
  IServices
} from './infra-types';

export const defaultDbService: IDbService = {
  NewDbConnection: () => (): void => {},
  QueryProfile: dbConnection => (userId: UserId): Promise<Either<Error, Profile>> =>
    Promise.resolve(
      right({
        userId,
        name: 'MarcoPolo',
        emailAddress: 'marcopolo@mp.com'
      })
    ),
  UpdateProfile: (dbConnection: DbConnection) => (profile: Profile): Promise<Either<Error, null>> =>
    Promise.resolve(right(null))
};

export const defaultSmtpCredentials: SmtpCredentials = () => {};

export const globalLogger: ILogger = {
  Info: (message: string) => {},
  Error: (message: string) => {}
};

export const defaultEmailService: IEmailService = {
  SendChangeNotification: smtpCredentials => (): Promise<Either<Error, null>> =>
    Promise.resolve(right(null))
};

export const testServices: IServices = {
  dbService: defaultDbService,
  emailService: defaultEmailService,
  logger: globalLogger
};
