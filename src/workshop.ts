/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * 
 Use case:
Let’s look at a concrete use-case that we can use as a basis to experiment with different implementations.

Say that we have some kind of web app with users, and each user has a “profile” with their name, email, preferences, etc. A use-case for updating their profile might be something like this:

Receive a new profile (parsed from a JSON request, say)
Read the user’s current profile from the database
If the profile has changed, update the user’s profile in the database
If the email has changed, send a verification email message to the user’s new email
We will also add a little bit of logging into the mix.

 */

import * as R from 'fp-ts/lib/Reader';
import {Either, isLeft, isRight} from 'fp-ts/lib/Either';
import {UserId, Profile, EmailMessage} from './business-types';
import {
  IDbService,
  DbConnection,
  SmtpCredentials,
  ILogger,
  IEmailService,
  Result
} from './infra-types';
import {
  defaultDbService,
  defaultSmtpCredentials,
  globalLogger,
  defaultEmailService
} from './default-services';

// -----------------------------------------------------------------------------------------------
// Dependency rejection

/*
Le code décisionnel et code impure (IO, del externes.. etc) sont (presque) séparés 

Pros:
- C'est aussi rapide à faire.
- La partie décisionnel (déterministe) du code devient testable
- La partie I/O c'est plus claire à comprendre
- Un peu plus facile à refactor que si le code était écrit à la Dependency retention (au moins pour la partie décisionnel)

Cons:
- Pas facile à tester l'ensemble du code (la partie i/o et archi c'est encore pas facilement, voir même pas, testable)
- Difficile de refactor s'il y a des modifications de l'architecture du code

*/

type Decision =
  | ['NoAction', null]
  | [
      'UpdateProfileOnly',
      {
        profile: Profile;
      }
    ]
  | [
      'UpdateProfileAndNotify',
      {
        profile: Profile;
        emailMessage: EmailMessage;
      }
    ];

const pureUpdateCustomerProfileDR = (newProfile: Profile, currentProfile: Profile): Decision => {
  if (currentProfile !== newProfile && (currentProfile as Profile).emailAddress) {
    globalLogger.Info('Updating Profile');
    if (currentProfile.emailAddress !== newProfile.emailAddress) {
      const emailMessage: EmailMessage = {
        To: newProfile.emailAddress,
        Body: 'Please verify your email'
      };
      globalLogger.Info('Sending email');
      return [
        'UpdateProfileAndNotify',
        {
          profile: newProfile,
          emailMessage
        }
      ];
    } else {
      return [
        'UpdateProfileOnly',
        {
          profile: newProfile
        }
      ];
    }
  } else {
    return ['NoAction', null];
  }
};

const updateCustomerProfileDR = async function* (
  newProfile: Profile
): AsyncGenerator<unknown, void, unknown> {
  const dbConnection = defaultDbService.NewDbConnection();
  const smtpCredentials = defaultSmtpCredentials;

  // ----------- impure ----------------
  const currentProfile = await defaultDbService.QueryProfile(dbConnection)(newProfile.userId);
  yield currentProfile;

  // ----------- pure ----------------
  if (isLeft(currentProfile)) return;
  const [decision, result] = pureUpdateCustomerProfileDR(newProfile, currentProfile.right);

  // ----------- impure ----------------
  switch (decision) {
    case 'NoAction':
      return;
    case 'UpdateProfileOnly':
      if (result && result.profile)
        yield defaultDbService.UpdateProfile(dbConnection)(result && result.profile);
      else return;
      break;
    case 'UpdateProfileAndNotify':
      if (result && result.profile) {
        yield defaultDbService.UpdateProfile(dbConnection)(result.profile);
        yield defaultEmailService.SendChangeNotification(smtpCredentials)({
          To: result.profile.emailAddress,
          Body: 'Please verify your email'
        });
      }
      break;
  }
};

// -----------------------------------------------------------------------------------------------
//  Dependency parameterization
/*
Le code décisionnel et code impure (IO, del externes.. etc) sont séparés, les dépendances sont données explicitement 

Pros:
- Initialement ça peut prendre plus de temps mais le code devient très flexible pour les modifications
- Tout le code devient testable, le code d'infra/IO est injecté, donc pas compliqué à tester en TU
- La partie I/O devient plus claire à comprendre
- Il est facile de les coupler avec d’autres types d'implémentations

Cons:
- Prends plus de temps initialement pour mettre en place
- Multiplie le nombre d'interfaces nécessaires
- Les fonctions deviennent gonflées de paramètres

*/

const pureUpdateCustomerProfileDP = (
  newProfile: Profile,
  currentProfile: Profile,
  logger: ILogger
): Decision => {
  if (currentProfile !== newProfile) {
    logger.Info('Updating Profile');
    if (currentProfile.emailAddress !== newProfile.emailAddress) {
      const emailMessage: EmailMessage = {
        To: newProfile.emailAddress,
        Body: 'Please verify your email'
      };
      logger.Info('Sending email');
      return [
        'UpdateProfileAndNotify',
        {
          profile: newProfile,
          emailMessage
        }
      ];
    } else {
      return [
        'UpdateProfileOnly',
        {
          profile: newProfile
        }
      ];
    }
  } else {
    return ['NoAction', null];
  }
};

type IServices = {
  logger: ILogger;
  dbService: IDbService;
  emailService: IEmailService;
};

const updateCustomerProfileDP = async function* (
  newProfile: Profile,
  services: IServices
): AsyncGenerator<unknown, void, unknown> {
  const dbConnection = defaultDbService.NewDbConnection();
  const smtpCredentials = defaultSmtpCredentials;

  // ----------- impure ----------------
  const currentProfile = await defaultDbService.QueryProfile(dbConnection)(newProfile.userId);
  yield currentProfile;

  // ----------- pure ----------------
  if (isLeft(currentProfile)) return;
  const [decision, result] = pureUpdateCustomerProfileDP(
    newProfile,
    currentProfile.right,
    services.logger
  );

  // ----------- impure ----------------
  switch (decision) {
    case 'NoAction':
      return;
    case 'UpdateProfileOnly':
      if (result) yield services.dbService.UpdateProfile(dbConnection)(result.profile);
      break;
    case 'UpdateProfileAndNotify':
      if (result) {
        yield services.dbService.UpdateProfile(dbConnection)(result.profile);
        yield services.emailService.SendChangeNotification(smtpCredentials)({
          To: result.profile.emailAddress,
          Body: 'Please verify your email'
        });
      }

      break;
  }
};

// const dbConnection = defaultDbService.NewDbConnection();
// const smtpCredentials = defaultSmtpCredentials;
// very similar to ports? services -> function -> result

const updateCustomerProfileDP2 = (
  services: IServices,
  dbConnection: DbConnection,
  smtpCredentials: SmtpCredentials
) => {
  return async function* (newProfile: Profile): AsyncGenerator<unknown, void, unknown> {
    // ----------- impure ----------------
    const currentProfile = await defaultDbService.QueryProfile(dbConnection)(newProfile.userId);
    yield currentProfile;

    // ----------- pure ----------------
    if (isLeft(currentProfile)) return;
    const [decision, result] = pureUpdateCustomerProfileDP(
      newProfile,
      currentProfile.right,
      services.logger
    );

    // ----------- impure ----------------
    switch (decision) {
      case 'NoAction':
        return;
      case 'UpdateProfileOnly':
        if (result) yield services.dbService.UpdateProfile(dbConnection)(result.profile);
        break;
      case 'UpdateProfileAndNotify':
        if (result) {
          yield services.dbService.UpdateProfile(dbConnection)(result.profile);
          yield services.emailService.SendChangeNotification(smtpCredentials)({
            To: result.profile.emailAddress,
            Body: 'Please verify your email'
          });
        }
        break;
    }
  };
};

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

const pureUpdateCustomerProfileReader = (
  newProfile: Profile,
  currentProfile: Profile
): R.Reader<ILogger, Decision> => (logger: ILogger) => {
  if (currentProfile !== newProfile) {
    logger.Info('Updating Profile');
    if (currentProfile.emailAddress !== newProfile.emailAddress) {
      const emailMessage: EmailMessage = {
        To: newProfile.emailAddress,
        Body: 'Please verify your email'
      };
      logger.Info('Sending email');
      return [
        'UpdateProfileAndNotify',
        {
          profile: newProfile,
          emailMessage
        }
      ];
    } else {
      return [
        'UpdateProfileOnly',
        {
          profile: newProfile
        }
      ];
    }
  } else {
    return ['NoAction', null];
  }
};

const updateCustomerProfileRM = (services: IServices) => {
  const dbConnection = defaultDbService.NewDbConnection();
  const smtpCredentials = defaultSmtpCredentials;
  return async function* (newProfile: Profile): AsyncGenerator<unknown, void, unknown> {
    // ----------- impure ----------------
    const currentProfile = await defaultDbService.QueryProfile(dbConnection)(newProfile.userId);
    yield currentProfile;

    // ----------- pure ----------------
    if (isLeft(currentProfile)) return;
    const reader: R.Reader<ILogger, Decision> = R.reader.map(
      pureUpdateCustomerProfileReader(newProfile, currentProfile.right),
      _decision => _decision
    );
    const [decision, result] = reader(services.logger);

    // ----------- impure ----------------
    switch (decision) {
      case 'NoAction':
        return;
      case 'UpdateProfileOnly':
        if (result) yield services.dbService.UpdateProfile(dbConnection)(result.profile);
        break;
      case 'UpdateProfileAndNotify':
        if (result) {
          yield services.dbService.UpdateProfile(dbConnection)(result.profile);
          yield services.emailService.SendChangeNotification(smtpCredentials)({
            To: result.profile.emailAddress,
            Body: 'Please verify your email'
          });
        }
        break;
    }
  };
};

type Reader<E, T> = (env: E) => Promise<T>;
type App<A, E, T> = (a: A) => Reader<E, T>;

const runReader = <E, T>(env: E, fa: Reader<E, T>): Promise<T> => fa(env);

const pure = <E, T>(a: T): Reader<E, T> => () => Promise.resolve(a);

const map = <E, A, B>(fa: Reader<E, A>, ab: (a: A) => B): Reader<E, B> => {
  return (env: E) => runReader<E, A>(env, fa).then(ab);
};

const fmap = <E, A, B>(fa: Reader<E, A>, afb: (a: A) => Reader<E, B>): Reader<E, B> => {
  return (env: E) => {
    return runReader<E, A>(env, fa).then(a => runReader(env, afb(a)));
  };
};

const logInfo: App<string, IServices, void> = (message: string) => (env: IServices) =>
  Promise.resolve(env.logger.Info(message));
const update: App<Profile, IServices, void> = (profile: Profile) => async (env: IServices) => {
  const dbConnection = defaultDbService.NewDbConnection();
  await env.dbService.UpdateProfile(dbConnection)(profile);
};
const sendChangeNotification: App<EmailMessage, IServices, void> = (
  emailMessage: EmailMessage
) => async (env: IServices) => {
  await env.emailService.SendChangeNotification(defaultSmtpCredentials)(emailMessage);
};

const queryProfile: App<string, IServices, Result<Error, Profile>> = (userId: string) => (
  env: IServices
) => {
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

const newProfileA: Profile = {
  userId: 'someid1',
  emailAddress: 'toto@coorpacademy.com',
  name: 'Toto Foo'
};
const job = appMonad(newProfileA);

const testServices: IServices = {
  dbService: defaultDbService,
  emailService: defaultEmailService,
  logger: globalLogger
};

runReader(testServices, job);

const prodServices: IServices = {
  dbService: defaultDbService,
  emailService: defaultEmailService,
  logger: globalLogger
};

runReader(prodServices, job);

// -----------------------------------------------------------------------------------------------
// Dependency interpretation

/*
Le code décisionnel et code impure (IO, del externes.. etc) sont séparés, les dépendances sont données explicitement 

Pros:
- Le code d'infra/IO est toujours paramétrable si souhaité
- Pas trop de parametres necessaires
- L'interpreter devient interchangeable
- Le code pure n'a pas besoin de gérer lui même le code async (tout peut être compris dans l'interpreter)

Cons:
- Plus long à mettre en place (mais contrairement au Reader, c'est plus lisible)
- Multiplie le nombre d'interfaces nécessaires
- Multiplie le nombre de fonctions nécessaires
- il est difficile de les coupler avec d’autres types d'implémentations (il est facile de tomber dans un «Type Tetris»)
- Contrairement aux techniques de “dependency rejection” et “dependency parameterization”, qui ne nécessitent (presque)
  aucune connaissance particulière, les approches Reader et Interpreter demandent plus d'expertise.
- Le debugging c'est plus complexe à suivre
- Performance: structure de données très profondément imbriquée pour un programme large (ex: +1000 instructions), l'interprétation
  peut être lente, utiliser beaucoup de mémoire, déclencher plus de garbage collection et même provoquer des stack overflows.
  ** Il y a des techniques pour soulager ça mais ça complifié le code encore plus - ex. voir Trampolines: 
  https://johnazariah.github.io/2020/12/07/bouncing-around-with-recursion.html#trampolines)

*/

type LoggerInstruction = ['Info', string] | ['Error', string];
type DbInstruction = ['Query', UserId] | ['Update', Profile];
type EmailInstruction = ['SendChangeNotification', EmailMessage];
type Instruction = LoggerInstruction | DbInstruction | EmailInstruction;

const app = function* (newProfile: Profile): Generator<Instruction, void, unknown> {
  const currentProfile = (yield ['Query', newProfile.userId]) as Either<Error, Profile>;

  if (isRight(currentProfile) && currentProfile.right !== newProfile) {
    yield ['Info', 'Updating Profile'];
    if (currentProfile.right.emailAddress !== newProfile.emailAddress) {
      const emailMessage: EmailMessage = {
        To: newProfile.emailAddress,
        Body: 'Please verify your email'
      };
      yield ['Info', 'Sending email'];
      yield ['Update', newProfile];
      yield ['SendChangeNotification', emailMessage];
    } else {
      yield ['Update', newProfile];
    }
  } else {
    return;
  }
};

const interpret = (services: IServices) => async (
  instruction: Instruction,
  // eslint-disable-next-line @coorpacademy/coorpacademy/no-async-callback
  next: (data: unknown) => void
) => {
  switch (instruction[0]) {
    case 'Info': {
      services.logger.Info(instruction[1]);
      return next(undefined);
    }
    case 'Error': {
      services.logger.Error(instruction[1]);
      return next(undefined);
    }
    case 'Query': {
      const dbConnection = defaultDbService.NewDbConnection();
      const currentProfile = await services.dbService.QueryProfile(dbConnection)(instruction[1]);
      return next(currentProfile);
    }
    case 'Update': {
      const dbConnection = defaultDbService.NewDbConnection();
      const currentProfile = await services.dbService.UpdateProfile(dbConnection)(instruction[1]);
      return next(currentProfile);
    }
    case 'SendChangeNotification': {
      await services.emailService.SendChangeNotification(defaultSmtpCredentials)(instruction[1]);
      return next(undefined);
    }
  }
};

const run = <T, TR>(_interpret: (instruction: T, next: (data: unknown) => void) => void) => (
  _app: Generator<T, TR, unknown>
) => {
  const loop = async (nextValue: unknown) => {
    const {done, value} = _app.next(nextValue);
    if (done) return value;
    await _interpret(value as T, loop);
  };

  return loop(undefined);
};

await run(interpret(testServices))(app(newProfileA));
