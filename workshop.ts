/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable unicorn/consistent-function-scoping */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
/**
 * Use case:
Let’s look at a concrete use-case that we can use as a basis to experiment with different implementations.

Say that we have some kind of web app with users, and each user has a “profile” with their name, email, preferences, etc. A use-case for updating their profile might be something like this:

Receive a new profile (parsed from a JSON request, say)
Read the user’s current profile from the database
If the profile has changed, update the user’s profile in the database
If the email has changed, send a verification email message to the user’s new email
We will also add a little bit of logging into the mix.
 */

import * as R from 'fp-ts/lib/Reader';

// --------------------------------------------------

// the types

// business types
type UserId = number;
type UserName = string;
type EmailAddress = string;

type Profile = {
  userId: UserId;
  name: UserName;
  emailAddress: EmailAddress;
};

type EmailMessage = {
  To: EmailAddress;
  Body: string;
};

// Infra types
type ILogger = {
  Info: (message: string) => void;
  Error: (message: string) => void;
};

type InfrastructureError = Error;

type DbConnection = () => void; // dummy definition

type Result<TError, T> = T | TError;

type IDbService = {
  NewDbConnection: () => DbConnection;
  QueryProfile: (
    dbConnection: DbConnection
  ) => (userId: UserId) => Promise<Result<InfrastructureError, Profile>>;
  UpdateProfile: (
    dbConnection: DbConnection
  ) => (profile: Profile) => Promise<Result<InfrastructureError, void>>;
};

type SmtpCredentials = () => void; // dummy definition

type IEmailService = {
  SendChangeNotification: (
    smtpCredentials: SmtpCredentials
  ) => (emailMessage: EmailMessage) => Promise<Result<InfrastructureError, void>>;
};

// Approach #1: Dependency retention -- retention des dépendances
/*
Il ya pas de abstraction ou paramétrisation,
Le code décisionnel et code impure (IO, del externes.. etc) sont melangés

Pros:
- Rapid à faire (scriptings, prototypes, etc)

Cons:
- Pas facile à tester (ou meme pas testable de tout)
- Difficile de refactor (car en chaine pas facile à tester, donc pas backup des tests fiables)
- Les sections de code que pourraient être déterministes sont mélangés

*/

const defaultDbService: IDbService = {
  NewDbConnection: () => (): void => {},
  QueryProfile: dbConnection => (userId: UserId) =>
    Promise.resolve({
      userId,
      name: 'MarcoPolo',
      emailAddress: 'marcopolo@mp.com'
    }),
  UpdateProfile: (dbConnection: DbConnection) => (profile: Profile) => Promise.resolve(undefined)
};

const defaultSmtpCredentials: SmtpCredentials = () => {};

const globalLogger: ILogger = {
  Info: (message: string) => {},
  Error: (message: string) => {}
};

const defaultEmailService: IEmailService = {
  SendChangeNotification: smtpCredentials => () => Promise.resolve(undefined)
};

const updateCustomerProfileDepRet = async function* (
  newProfile: Profile
): AsyncGenerator<unknown, void, unknown> {
  const dbConnection = defaultDbService.NewDbConnection();
  const smtpCredentials = defaultSmtpCredentials;
  const currentProfile = await defaultDbService.QueryProfile(dbConnection)(newProfile.userId);

  if (currentProfile !== newProfile) {
    globalLogger.Info('Updating Profile');
    yield defaultDbService.UpdateProfile(dbConnection)(newProfile);
  }

  if ((currentProfile as Profile).emailAddress !== newProfile.emailAddress) {
    const emailMessage = {
      To: newProfile.emailAddress,
      Body: 'Please verify your email'
    };
    globalLogger.Info('Sending email');
    yield defaultEmailService.SendChangeNotification(smtpCredentials)(emailMessage);
  }
};

// -----------------------------------------------------------------------------------------------
// Dependency rejection

/*
Le code décisionnel et code impure (IO, del externes.. etc) sont (presque) séparés 

Pros:
- C'est aussi rapid à faire.
- La partie décisionnel (déterministe) du code devient testable
- La partie I/O c'est plus claire à comprendre
- Un peu plus facile à refactor que si le code était écrit à la Dependency retention (au moins pour la partie décisionnel)

Cons:
- Pas facile à tester l'ensemble du code (la partie i/o et archi c'est encore pas facilement, voir meme pas, testable)
- Difficile de refactor s'il y a des modifications de l'architecture du code

*/

type Decision =
  | ['NoAction', undefined]
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

const pureUpdateCustomerProfileDR = (
  newProfile: Profile,
  currentProfile: Result<Error, Profile>
): Decision => {
  if (currentProfile !== newProfile) {
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
    return ['NoAction', undefined];
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
  const [decision, result] = pureUpdateCustomerProfileDR(newProfile, currentProfile);

  // ----------- impure ----------------
  switch (decision) {
    case 'NoAction':
      return;
    case 'UpdateProfileOnly':
      yield defaultDbService.UpdateProfile(dbConnection)(result.profile);
      break;
    case 'UpdateProfileAndNotify':
      yield defaultDbService.UpdateProfile(dbConnection)(result.profile);
      yield defaultEmailService.SendChangeNotification(smtpCredentials)(result.emailMessage);
      break;
  }
};

// -----------------------------------------------------------------------------------------------
//  Dependency parameterization

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
    return ['NoAction', undefined];
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
  const [decision, result] = pureUpdateCustomerProfileDP(
    newProfile,
    currentProfile,
    services.logger
  );

  // ----------- impure ----------------
  switch (decision) {
    case 'NoAction':
      return;
    case 'UpdateProfileOnly':
      yield services.dbService.UpdateProfile(dbConnection)(result.profile);
      break;
    case 'UpdateProfileAndNotify':
      yield services.dbService.UpdateProfile(dbConnection)(result.profile);
      yield services.emailService.SendChangeNotification(smtpCredentials)(result.emailMessage);
      break;
  }
};

// very similar to ports? services -> function -> result

const updateCustomerProfileDP2 = (services: IServices) =>
  async function* (newProfile: Profile): AsyncGenerator<unknown, void, unknown> {
    const dbConnection = defaultDbService.NewDbConnection();
    const smtpCredentials = defaultSmtpCredentials;

    // ----------- impure ----------------
    const currentProfile = await defaultDbService.QueryProfile(dbConnection)(newProfile.userId);
    yield currentProfile;

    // ----------- pure ----------------
    const [decision, result] = pureUpdateCustomerProfileDP(
      newProfile,
      currentProfile,
      services.logger
    );

    // ----------- impure ----------------
    switch (decision) {
      case 'NoAction':
        return;
      case 'UpdateProfileOnly':
        yield services.dbService.UpdateProfile(dbConnection)(result.profile);
        break;
      case 'UpdateProfileAndNotify':
        yield services.dbService.UpdateProfile(dbConnection)(result.profile);
        yield services.emailService.SendChangeNotification(smtpCredentials)(result.emailMessage);
        break;
    }
  };

// -----------------------------------------------------------------------------------------------
// Reader monad
// Delaying the injection of dependencies

// Simple reader Monad
// function reader(k: Function) {
//   return {
//     run: (e: Function) => {
//       return k(e);
//     },
//     bind: (f: Function) => {
//       return reader(function (e: Function) {
//         return f(k(e)).run(e);
//       });
//     },
//     map: (f: Function) => {
//       return reader(function (e: Function) {
//         return f(k(e));
//       });
//     }
//   };
// }

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
    return ['NoAction', undefined];
  }
};

const updateCustomerProfileRM = (services: IServices) =>
  async function* (newProfile: Profile): AsyncGenerator<unknown, void, unknown> {
    const dbConnection = defaultDbService.NewDbConnection();
    const smtpCredentials = defaultSmtpCredentials;

    // ----------- impure ----------------
    const currentProfile = await defaultDbService.QueryProfile(dbConnection)(newProfile.userId);
    yield currentProfile;

    // ----------- pure ----------------
    const reader: R.Reader<ILogger, Decision> = R.reader.map(
      pureUpdateCustomerProfileReader(newProfile, currentProfile),
      _decision => _decision
    );
    const [decision, result] = reader(services.logger);

    // ----------- impure ----------------
    switch (decision) {
      case 'NoAction':
        return;
      case 'UpdateProfileOnly':
        yield services.dbService.UpdateProfile(dbConnection)(result.profile);
        break;
      case 'UpdateProfileAndNotify':
        yield services.dbService.UpdateProfile(dbConnection)(result.profile);
        yield services.emailService.SendChangeNotification(smtpCredentials)(result.emailMessage);
        break;
    }
  };

// -----------------------------------------------------------------------------------------------
// Dependency interpretation
