/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable unicorn/consistent-function-scoping */
import test from 'ava';
import {isLeft, isRight, Left, left, Right, right} from 'fp-ts/lib/Either';
import {DbError, IServices} from '../src/infra-types';
import {updateCustomerProfileV2 as updateCustomerProfile} from '../src/dependency-parameterization';
import {Profile} from '../src/business-types';
import {defaultDbService, defaultSmtpCredentials} from '../src/default-services';
import {createTestServices} from './helpers/services';

test('Update customer profile if the user is found', async t => {
  t.plan(7);
  const expectedProfile: Profile = {
    userId: '1234',
    name: 'MarcoPolo',
    emailAddress: 'marcopolo@mp.com'
  };
  const dbService: IServices['dbService'] = {
    ...defaultDbService,
    QueryProfile: () => userId => {
      t.is(userId, expectedProfile.userId);
      return Promise.resolve(
        right({
          userId,
          name: expectedProfile.emailAddress,
          emailAddress: expectedProfile.emailAddress
        })
      );
    },
    UpdateProfile: () => profile => {
      t.deepEqual(profile, expectedProfile);
      return Promise.resolve(right(null));
    }
  };
  const services = createTestServices({dbService});
  const processSteps = await updateCustomerProfile(
    services,
    defaultSmtpCredentials
  )(expectedProfile);
  // const firstStep = <Right<Profile>>(await processSteps.next()).value;
  // t.true(isRight(firstStep));
  // t.deepEqual(firstStep.right, {
  //   userId: '1234',
  //   name: 'marcopolo@mp.com',
  //   emailAddress: 'marcopolo@mp.com'
  // });

  // const secondStep = <Right<null>>(await processSteps.next()).value;
  // t.true(isRight(secondStep));
  // t.is(secondStep.right, null);

  // for await (const step of processSteps) {}

  let iterations = 0;
  await t.notThrowsAsync(async () => {
    // eslint-disable-next-line fp/no-loops
    for await (const step of processSteps) {
      switch (iterations) {
        // 1st step
        case 0:
          {
            const firstStep = <Right<Profile>>step;
            t.true(isRight(firstStep));
            t.deepEqual(firstStep.right, {
              userId: '1234',
              name: 'marcopolo@mp.com',
              emailAddress: 'marcopolo@mp.com'
            });
          }
          break;
        case 1:
          {
            const secondStep = <Right<null>>step;
            t.true(isRight(secondStep));
            t.is(secondStep.right, null);
          }
          break;
        default:
          break;
      }
      iterations++;
    }
  });
  t.is(iterations, 2);
});

test('if user is not found, do nothing', async t => {
  t.plan(6);
  const expectedProfile: Profile = {
    userId: '1234',
    name: 'MarcoPolo',
    emailAddress: 'marcopolo@mp.com'
  };
  const dbService: IServices['dbService'] = {
    ...defaultDbService,
    QueryProfile: () => userId => {
      t.is(userId, expectedProfile.userId);
      return Promise.resolve(left(new DbError('not found')));
    },
    UpdateProfile: () => () => {
      t.fail();
      return Promise.resolve(left(new DbError('unknown error')));
    }
  };
  const services = createTestServices({dbService});
  const processSteps = await updateCustomerProfile(
    services,
    defaultSmtpCredentials
  )(expectedProfile);

  let iterations = 0;
  await (async function () {
    // eslint-disable-next-line fp/no-loops
    for await (const step of processSteps) {
      switch (iterations) {
        // 1st step
        case 0:
          {
            const firstStep = <Left<DbError>>step;
            t.true(isLeft(firstStep));
            t.deepEqual(firstStep.left, new DbError('not found'));
          }
          break;
        default:
          break;
      }
      iterations++;
    }
  })();
  t.is(iterations, 1);
});
