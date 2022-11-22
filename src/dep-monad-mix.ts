import * as R from 'fp-ts/lib/Reader';
import {isLeft} from 'fp-ts/lib/Either';
import {Profile, EmailMessage, Decision} from './business-types';
import {ILogger, IServices} from './infra-types';
import {defaultSmtpCredentials} from './default-services';

const updateCustomerProfileReader =
  (newProfile: Profile, currentProfile: Profile): R.Reader<ILogger, Decision> =>
  (logger: ILogger): Decision => {
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
export const updateCustomerProfile = (
  services: IServices
): ((newProfile: Profile) => AsyncGenerator<unknown, void, unknown>) => {
  const {dbService, emailService, logger} = services;
  const dbConnection = dbService.NewDbConnection();
  const smtpCredentials = defaultSmtpCredentials;
  return async function* (newProfile: Profile): AsyncGenerator<unknown, void, unknown> {
    // ----------- impure ----------------
    const currentProfile = await dbService.QueryProfile(dbConnection)(newProfile.userId);
    yield currentProfile;

    // ----------- pure ----------------
    if (isLeft(currentProfile)) return;
    const reader: R.Reader<ILogger, Decision> = R.reader.map(
      updateCustomerProfileReader(newProfile, currentProfile.right),
      _decision => _decision
    );
    const [decision, result] = reader(logger);

    // ----------- impure ----------------
    switch (decision) {
      case 'NoAction':
        return;
      case 'UpdateProfileOnly':
        if (result) yield dbService.UpdateProfile(dbConnection)(result.profile);
        break;
      case 'UpdateProfileAndNotify':
        if (result) {
          yield dbService.UpdateProfile(dbConnection)(result.profile);
          yield emailService.SendChangeNotification(smtpCredentials)({
            To: result.profile.emailAddress,
            Body: 'Please verify your email'
          });
        }
        break;
    }
  };
};
