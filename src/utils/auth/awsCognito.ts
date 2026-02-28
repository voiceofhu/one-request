import { Amplify } from "aws-amplify";
import { signIn } from "aws-amplify/auth";
import type { BeforeRequestHook } from "got";

async function login(
  username: string,
  password: string,
  region: string,
  userPoolId: string,
  clientId: string,
): Promise<{
  authId: string;
  idToken: string;
  accessToken: string;
}> {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId: clientId,
      },
    },
  });

  const { isSignedIn, nextStep } = await signIn({ username, password });

  if (!isSignedIn) {
    throw Error(
      `Invalid auth response or next step required: ${JSON.stringify(nextStep, null, 2)}`,
    );
  }

  // Actually, we need jwt tokens. Amplify v6 has `fetchAuthSession`
  const { fetchAuthSession } = await import("aws-amplify/auth");
  const session = await fetchAuthSession();

  const authId = session.tokens?.idToken?.payload?.sub ?? username;
  const idToken = session.tokens?.idToken?.toString() ?? "";
  const accessToken = session.tokens?.accessToken?.toString() ?? "";

  if (!idToken || !accessToken) {
    throw Error(`Invalid auth session response`);
  }

  return {
    authId,
    idToken,
    accessToken,
  };
}

export async function awsCognito(
  authorization: string,
): Promise<BeforeRequestHook> {
  const [, username, password, region, userPoolId, clientId] =
    authorization.split(/\s+/);

  const { accessToken } = await login(
    username,
    password,
    region,
    userPoolId,
    clientId,
  );

  return async (options) => {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    };
  };
}
