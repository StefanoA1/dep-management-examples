import {isLeft} from 'fp-ts/lib/Either';
import {Profile, EmailMessage, Decision} from './business-types';
import {DbConnection, SmtpCredentials, ILogger, IServices} from './infra-types';
import {defaultDbService, defaultSmtpCredentials} from './default-services';

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
const pureUpdateCustomerProfile = (
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

export const updateCustomerProfile = async function* (
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
  const [decision, result] = pureUpdateCustomerProfile(
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
export const updateCustomerProfileV2 = (
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
    const [decision, result] = pureUpdateCustomerProfile(
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
