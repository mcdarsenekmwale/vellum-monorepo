import {
  buildRelationUpdate,
  assignRelationUpdate,
  RequiredRelationDisconnectError,
} from './relation-update.util';

describe('buildRelationUpdate', () => {
  it('returns undefined when id is undefined (no change)', () => {
    expect(buildRelationUpdate(undefined)).toBeUndefined();
  });

  it('connects when id is a non-empty string', () => {
    expect(buildRelationUpdate('abc-123')).toEqual({ connect: { id: 'abc-123' } });
  });

  it('disconnects when id is null for optional relations', () => {
    expect(buildRelationUpdate(null)).toEqual({ disconnect: true });
  });

  it('throws when id is null for required relations', () => {
    expect(() => buildRelationUpdate(null, { required: true })).toThrow(RequiredRelationDisconnectError);
  });
});

describe('assignRelationUpdate', () => {
  it('does not mutate data when id is undefined', () => {
    const data: Record<string, unknown> = {};
    assignRelationUpdate(data, 'department', undefined);
    expect(data).toEqual({});
  });

  it('assigns connect payload onto the relation field', () => {
    const data: Record<string, unknown> = {};
    assignRelationUpdate(data, 'department', 'dept-1');
    expect(data.department).toEqual({ connect: { id: 'dept-1' } });
  });

  it('assigns disconnect payload for null optional relations', () => {
    const data: Record<string, unknown> = {};
    assignRelationUpdate(data, 'lead', null);
    expect(data.lead).toEqual({ disconnect: true });
  });
});
