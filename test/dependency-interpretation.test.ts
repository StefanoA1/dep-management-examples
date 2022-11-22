/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable unicorn/consistent-function-scoping */
import test from 'ava';
import {left, right} from 'fp-ts/lib/Either';
import {DbError, IServices} from '../src/infra-types';
import {run, app as updateCustomerProfile, interpret} from '../src/dependency-interpretation';
import {Profile} from '../src/business-types';
import {defaultDbService} from '../src/default-services';
import {createTestServices} from './helpers/services';

test('Update customer profile if the user is found', async t => {
  t.plan(3);
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
  const interpretedServices = interpret(services);
  const runner = run(interpretedServices);
  await t.notThrowsAsync(() => runner(updateCustomerProfile(expectedProfile)));
});

test('if user is not found, return error', async t => {
  t.plan(2);
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
  const interpretedServices = interpret(services);
  const runner = run(interpretedServices);
  const expectedError = await runner(updateCustomerProfile(expectedProfile));
  t.deepEqual(expectedError, new Error('not found'));
});
