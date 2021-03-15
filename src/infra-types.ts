import {Either} from 'fp-ts/lib/Either';
import {UserId, Profile, EmailMessage} from './business-types';

export type ILogger = {
  Info: (message: string) => void;
  Error: (message: string) => void;
};
type InfrastructureError = Error;
export type DbConnection = () => void; // dummy definition

export type Result<TError, T> = Either<TError, T>;
export type IDbService = {
  NewDbConnection: () => DbConnection;
  QueryProfile: (
    dbConnection: DbConnection
  ) => (userId: UserId) => Promise<Result<InfrastructureError, Profile>>;
  UpdateProfile: (
    dbConnection: DbConnection
  ) => (profile: Profile) => Promise<Result<InfrastructureError, null>>;
};
export type SmtpCredentials = () => void; // dummy definition

export type IEmailService = {
  SendChangeNotification: (
    smtpCredentials: SmtpCredentials
  ) => (emailMessage: EmailMessage) => Promise<Result<InfrastructureError, null>>;
};

export type IServices = {
  logger: ILogger;
  dbService: IDbService;
  emailService: IEmailService;
};
