import {Either} from 'fp-ts/lib/Either';
import {UserId, Profile, EmailMessage} from './business-types';

export type ILogger = {
  Info: (message: string) => void;
  Error: (message: string) => void;
};
export class DbError extends Error {
  code: number | undefined;

  constructor(message: string, code?: number) {
    super(message);
    this.name = 'DbError';
    this.code = code;
  }
}

export class EmailError extends Error {
  code: number | undefined;

  constructor(message: string, code?: number) {
    super(message);
    this.name = 'EmailError';
    this.code = code;
  }
}

export type DbConnection = () => void; // dummy definition

export type Result<TError, T> = Either<TError, T>;
export type IDbService = {
  NewDbConnection: () => DbConnection;
  QueryProfile: (
    dbConnection: DbConnection
  ) => (userId: UserId) => Promise<Result<DbError, Profile>>;
  UpdateProfile: (
    dbConnection: DbConnection
  ) => (profile: Profile) => Promise<Result<DbError, null>>;
};
export type SmtpCredentials = () => void; // dummy definition

export type IEmailService = {
  SendChangeNotification: (
    smtpCredentials: SmtpCredentials
  ) => (emailMessage: EmailMessage) => Promise<Result<EmailError, null>>;
};

export type IServices = {
  logger: ILogger;
  dbService: IDbService;
  emailService: IEmailService;
};
