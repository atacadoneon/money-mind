import { ArgumentsHost, BadRequestException, ForbiddenException, HttpException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

const makeHost = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status };
  const req = { method: 'GET', url: '/api/v1/test', ip: '127.0.0.1' };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  beforeEach(() => { filter = new GlobalExceptionFilter(); });

  it('handles HttpException 404', () => {
    const { host, status, json } = makeHost();
    filter.catch(new NotFoundException('Not found'), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('handles HttpException 400 with message', () => {
    const { host, status, json } = makeHost();
    filter.catch(new BadRequestException('Bad input'), host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ message: expect.anything() }),
    }));
  });

  it('handles HttpException 403', () => {
    const { host, status } = makeHost();
    filter.catch(new ForbiddenException('No access'), host);
    expect(status).toHaveBeenCalledWith(403);
  });

  it('handles generic Error as 500', () => {
    const { host, status, json } = makeHost();
    filter.catch(new Error('Something broke'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'Error' }),
    }));
  });

  it('handles unknown exception as 500', () => {
    const { host, status } = makeHost();
    filter.catch('unknown string error', host);
    expect(status).toHaveBeenCalledWith(500);
  });

  it('response includes path and timestamp', () => {
    const { host, json } = makeHost();
    filter.catch(new InternalServerErrorException('fail'), host);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ path: '/api/v1/test', timestamp: expect.any(String) }),
    }));
  });

  it('handles HttpException with code in response object', () => {
    const { host, json } = makeHost();
    const ex = new HttpException({ code: 'CUSTOM_CODE', message: 'Custom' }, 422);
    filter.catch(ex, host);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'CUSTOM_CODE' }),
    }));
  });
});
