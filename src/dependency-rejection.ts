import {isLeft} from 'fp-ts/lib/Either';
import {Profile, EmailMessage, Decision} from './business-types';
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
const pureUpdateCustomerProfile = (newProfile: Profile, currentProfile: Profile): Decision => {
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

export const updateCustomerProfile = async function* (
  newProfile: Profile
): AsyncGenerator<unknown, void, unknown> {
  const dbConnection = defaultDbService.NewDbConnection();
  const smtpCredentials = defaultSmtpCredentials;

  // ----------- impure ----------------
  const currentProfile = await defaultDbService.QueryProfile(dbConnection)(newProfile.userId);
  yield currentProfile;

  // ----------- pure ----------------
  if (isLeft(currentProfile)) return;
  const [decision, result] = pureUpdateCustomerProfile(newProfile, currentProfile.right);

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
