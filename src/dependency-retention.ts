// Approach #1: Dependency retention -- retention des dépendances
/*
Il ya pas de abstraction ou paramétrisation,
Le code décisionnel et code impure (IO, del externes.. etc) sont mélangés

Pros:
- Rapid à faire (scriptings, prototypes, etc)

Cons:
- Pas facile à tester (ou même pas testable de tout)
- Difficile de refactor (car en chaîne pas facile à tester, donc pas backup des tests fiables)
- Les sections de code que pourraient être déterministes sont mélangés

*/

import {isLeft} from 'fp-ts/lib/Either';
import {Profile} from './business-types';
import {
  defaultDbService,
  defaultEmailService,
  defaultSmtpCredentials,
  globalLogger
} from './default-services';

export const updateCustomerProfile = async function* (
  newProfile: Profile
): AsyncGenerator<unknown, void, unknown> {
  const dbConnection = defaultDbService.NewDbConnection();
  const smtpCredentials = defaultSmtpCredentials;
  const currentProfile = await defaultDbService.QueryProfile(dbConnection)(newProfile.userId);

  if (isLeft(currentProfile)) return;

  if (currentProfile.right !== newProfile) {
    globalLogger.Info('Updating Profile');
    yield defaultDbService.UpdateProfile(dbConnection)(newProfile);
  }

  if (currentProfile.right.emailAddress !== newProfile.emailAddress) {
    const emailMessage = {
      To: newProfile.emailAddress,
      Body: 'Please verify your email'
    };
    globalLogger.Info('Sending email');
    yield defaultEmailService.SendChangeNotification(smtpCredentials)(emailMessage);
  }
};
