import {isRight} from 'fp-ts/lib/Either';
import {Profile, EmailMessage} from './business-types';
import {IServices, Result} from './infra-types';
import {
  defaultDbService,
  defaultSmtpCredentials,
  globalLogger,
  defaultEmailService,
  testServices
} from './default-services';

// -----------------------------------------------------------------------------------------------
// Reader monad
// Delaying the injection of dependencies
/*
Le code décisionnel et code impure (IO, del externes.. etc) sont séparés, les dépendances sont données explicitement

Pros:
- Le code d'infra/IO est injecté au moment d'appel de la fonction, donc pas compliqué à tester (le switch entre deps prod/test/dev/ etc c'est facile à faire)
- Réduction de parametres necessaires

Cons:
- Plus long à mettre en place (et même moins lisible)
- Multiplie le nombre d'interfaces nécessaires
- Multiplie le nombre de fonctions nécessaires
- il est difficile de les coupler avec d’autres types d'implémentations (il est facile de tomber dans un «Type Tetris»)

*/

type Reader<E, T> = (env: E) => Promise<T>;
type App<A, E, T> = (a: A) => Reader<E, T>;
const runReader = <E, T>(env: E, fa: Reader<E, T>): Promise<T> => fa(env);
const pure =
  <E, T>(a: T): Reader<E, T> =>
  (): Promise<T> =>
    Promise.resolve(a);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const map = <E, A, B>(fa: Reader<E, A>, ab: (a: A) => B): Reader<E, B> => {
  return (env: E): Promise<B> => runReader<E, A>(env, fa).then(ab);
};

const fmap = <E, A, B>(fa: Reader<E, A>, afb: (a: A) => Reader<E, B>): Reader<E, B> => {
  return (env: E): Promise<B> => {
    return runReader<E, A>(env, fa).then(a => runReader(env, afb(a)));
  };
};

const logInfo: App<string, IServices, void> =
  (message: string) =>
  (env: IServices): Promise<void> =>
    Promise.resolve(env.logger.Info(message));

const update: App<Profile, IServices, void> =
  (profile: Profile) =>
  async (env: IServices): Promise<void> => {
    const dbConnection = env.dbService.NewDbConnection();
    await env.dbService.UpdateProfile(dbConnection)(profile);
  };

const sendChangeNotification: App<EmailMessage, IServices, void> =
  (emailMessage: EmailMessage) =>
  async (env: IServices): Promise<void> => {
    await env.emailService.SendChangeNotification(defaultSmtpCredentials)(emailMessage);
  };

const queryProfile: App<string, IServices, Result<Error, Profile>> =
  (userId: string) =>
  (env: IServices): Promise<Result<Error, Profile>> => {
    const dbConnection_ = env.dbService.NewDbConnection();
    return env.dbService.QueryProfile(dbConnection_)(userId);
  };

const sendEmailLog = logInfo('Sending email');

const appMonad: App<Profile, IServices, void> = (newProfile: Profile) =>
  fmap(queryProfile(newProfile.userId), currentProfile => {
    if (isRight(currentProfile) && currentProfile.right !== newProfile) {
      return fmap(logInfo('Updating Profile'), () => {
        if (currentProfile.right.emailAddress !== newProfile.emailAddress) {
          const emailMessage: EmailMessage = {
            To: newProfile.emailAddress,
            Body: 'Please verify your email'
          };
          return fmap(sendEmailLog, () =>
            fmap(update(newProfile), () => sendChangeNotification(emailMessage))
          );
        } else {
          return update(newProfile);
        }
      });
    } else {
      return pure(undefined);
    }
  });

export const newProfileA: Profile = {
  userId: 'someid1',
  emailAddress: 'toto@coorpacademy.com',
  name: 'Toto Foo'
};

const job = appMonad(newProfileA);

runReader(testServices, job);

const prodServices: IServices = {
  dbService: defaultDbService,
  emailService: defaultEmailService,
  logger: globalLogger
};

runReader(prodServices, job);
