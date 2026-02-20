const { fetchOgImage } = require('../../src/utils/ogImage');
const axios = require('axios');

jest.mock('axios');

describe('fetchOgImage', () => {
  afterEach(() => jest.resetAllMocks());

  it('extracts og:image and downloads it', async () => {
    const html = '<html><head><meta property="og:image" content="https://example.com/img.jpg"></head></html>';
    axios.get
      .mockResolvedValueOnce({ data: html })
      .mockResolvedValueOnce({ data: Buffer.from('fake-image') });

    const buf = await fetchOgImage('https://example.com/article');
    expect(buf).toBeInstanceOf(Buffer);
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('handles reversed meta attribute order', async () => {
    const html = '<html><head><meta content="https://example.com/img.jpg" property="og:image"></head></html>';
    axios.get
      .mockResolvedValueOnce({ data: html })
      .mockResolvedValueOnce({ data: Buffer.from('fake-image') });

    const buf = await fetchOgImage('https://example.com/article');
    expect(buf).toBeInstanceOf(Buffer);
  });

  it('returns null when no og:image found', async () => {
    axios.get.mockResolvedValueOnce({ data: '<html><head></head></html>' });
    const buf = await fetchOgImage('https://example.com/no-image');
    expect(buf).toBeNull();
  });

  it('returns null on network error', async () => {
    axios.get.mockRejectedValueOnce(new Error('timeout'));
    const buf = await fetchOgImage('https://example.com/fail');
    expect(buf).toBeNull();
  });
});
