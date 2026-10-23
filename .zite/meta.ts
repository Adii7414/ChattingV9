import { getSdkCall } from '../../../node_modules/zitejs/dist/esm/internal/sdkCall.js';

const META_SDK_INTEGRATION_ID = '__meta__';

export type ZiteProjectUser = {
  uuid: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profilePictureUrl: string | null;
};

export type MetaListUsersResult = {
  users: ZiteProjectUser[];
};

export type ZiteWorkspace = {
  workspaceHomeUrl: string;
  editorUrl: string;
  appPublicIdentifier: string;
  projectPublicIdentifier: string;
};

export class ZiteMeta {
  static listUsers(): Promise<MetaListUsersResult> {
    return getSdkCall()(
      META_SDK_INTEGRATION_ID,
      'ZiteMeta',
      'listUsers',
      {},
    ) as Promise<MetaListUsersResult>;
  }

  /** Workspace home + this app's editor URL for *this* clone. */
  static getWorkspace(): Promise<ZiteWorkspace> {
    return getSdkCall()(
      META_SDK_INTEGRATION_ID,
      'ZiteMeta',
      'getWorkspace',
      {},
    ) as Promise<ZiteWorkspace>;
  }
}

export const Meta = ZiteMeta;
