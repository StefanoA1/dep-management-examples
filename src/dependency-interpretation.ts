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

import {Either, isRight} from 'fp-ts/lib/Either';
import {UserId, Profile, EmailMessage} from './business-types';
import {IServices} from './infra-types';
import {defaultSmtpCredentials} from './default-services';
// import {newProfileA} from './dependency-delay-reader-monad';

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

export const app = function* (newProfile: Profile): Generator<Instruction, void, unknown> {
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

export const interpret =
  (services: IServices) =>
  async (
    instruction: Instruction,
    // eslint-disable-next-line @coorpacademy/coorpacademy/no-async-callback
    next: (data: unknown) => void
  ): Promise<void> => {
    const {dbService, emailService, logger} = services;
    switch (instruction[0]) {
      case 'Info': {
        logger.Info(instruction[1]);
        return next(undefined);
      }
      case 'Error': {
        logger.Error(instruction[1]);
        return next(undefined);
      }
      case 'Query': {
        const dbConnection = dbService.NewDbConnection();
        const currentProfile = await dbService.QueryProfile(dbConnection)(instruction[1]);
        return next(currentProfile);
      }
      case 'Update': {
        const dbConnection = dbService.NewDbConnection();
        const currentProfile = await dbService.UpdateProfile(dbConnection)(instruction[1]);
        return next(currentProfile);
      }
      case 'SendChangeNotification': {
        await emailService.SendChangeNotification(defaultSmtpCredentials)(instruction[1]);
        return next(undefined);
      }
    }
  };

export const run =
  <T, TR>(_interpret: (instruction: T, next: (data: unknown) => void) => void) =>
  (_app: Generator<T, TR, unknown>): Promise<T | TR | undefined> => {
    const loop = async (nextValue: unknown): Promise<T | TR | undefined> => {
      const {done, value} = _app.next(nextValue);
      if (done) return value;
      await _interpret(value as T, loop);
    };

    return loop(undefined);
  };

// await run(interpret(testServices))(app(newProfileA));
