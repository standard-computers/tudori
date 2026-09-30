// Removes the 1000-row cap on list reads: any GET select without an explicit
// limit/range is transparently fetched page by page and merged.
import { PostgrestBuilder } from '@supabase/postgrest-js';

const PAGE = 1000;
const proto = PostgrestBuilder.prototype as any;

if (!proto.__fetchAllPatched) {
  proto.__fetchAllPatched = true;
  const originalThen = proto.then;

  proto.then = function (onfulfilled?: any, onrejected?: any) {
    const self = this as any;
    const accept: string = self.headers?.get?.('Accept') || '';
    const url: URL | undefined = self.url;
    const eligible =
      !self.__paging &&
      self.method === 'GET' &&
      url instanceof URL &&
      !url.searchParams.has('limit') &&
      !url.searchParams.has('offset') &&
      !self.headers.get('Range') &&
      !self.isMaybeSingle &&
      !accept.includes('vnd.pgrst') &&
      !accept.includes('csv') &&
      !accept.includes('geo+json');

    if (!eligible) return originalThen.call(this, onfulfilled, onrejected);

    const runPage = (offset: number) => {
      const b = new (PostgrestBuilder as any)(self);
      b.url = new URL(url.toString());
      b.headers = new Headers(self.headers);
      b.url.searchParams.set('limit', String(PAGE));
      b.url.searchParams.set('offset', String(offset));
      b.__paging = true;
      return originalThen.call(b);
    };

    const run = async () => {
      const first: any = await runPage(0);
      if (first.error || !Array.isArray(first.data) || first.data.length < PAGE) return first;
      const all = [...first.data];
      let offset = PAGE;
      while (true) {
        const res: any = await runPage(offset);
        if (res.error) return res;
        const rows = Array.isArray(res.data) ? res.data : [];
        all.push(...rows);
        if (rows.length < PAGE) break;
        offset += PAGE;
      }
      return { ...first, data: all };
    };

    return run().then(onfulfilled, onrejected);
  };
}
