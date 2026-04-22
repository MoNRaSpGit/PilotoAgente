import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLoginWebUserPayload,
  parseRegisterWebUserPayload
} from '../src/modules/webAuth/webAuth.contract.js';

test('parseRegisterWebUserPayload normaliza payload valido', () => {
  const parsed = parseRegisterWebUserPayload({
    nombre: '  juan perez  ',
    password: 'Abc123!!'
  });

  assert.deepEqual(parsed, {
    nombre: 'juan perez',
    password: 'Abc123!!'
  });
});

test('parseRegisterWebUserPayload falla con nombre invalido', () => {
  assert.throws(
    () => parseRegisterWebUserPayload({
      nombre: '!!',
      password: 'Abc123!!'
    }),
    /al menos 3 caracteres|formato invalido/i
  );
});

test('parseRegisterWebUserPayload falla con password debil', () => {
  assert.throws(
    () => parseRegisterWebUserPayload({
      nombre: 'juan',
      password: '12345678'
    }),
    /password debe tener/i
  );
});

test('parseLoginWebUserPayload valida login minimo', () => {
  const parsed = parseLoginWebUserPayload({
    nombre: '  demo.web  ',
    password: 'Demo123!'
  });

  assert.deepEqual(parsed, {
    nombre: 'demo.web',
    password: 'Demo123!'
  });
});

test('parseLoginWebUserPayload falla sin credenciales', () => {
  assert.throws(
    () => parseLoginWebUserPayload({ nombre: '', password: '' }),
    /credenciales invalidas/i
  );
});

