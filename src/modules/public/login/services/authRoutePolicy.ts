export const AUTHENTICATED_APP_PATH = '/app';
export const LOGIN_PATH = '/login';

export const isStandalonePublicRoute = (pathname: string) => (
  /^(?:\/shared|\/s|\/cobranca)(?:\/|$)/.test(pathname)
  || pathname === '/demo-publico'
  || pathname.startsWith('/redefinir-senha')
);
