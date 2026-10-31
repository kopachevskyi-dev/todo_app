type Tag = { id: string; name: string; color: string };
type Mutate = (path: string, method: string, body?: unknown, after?: () => void) => void;

export function TagEditor({ tags, mutate }: { tags: Tag[]; mutate: Mutate }) {
  return <section aria-label="Edit tags" className="mt-3 space-y-3 border-t border-current/20 pt-3">
    <h3 className="font-semibold">Edit tags</h3>
    {tags.map(tag => <form key={`${tag.id}-${tag.name}-${tag.color}`} aria-label={tag.name} role="group" className="space-y-2 rounded border border-current/20 p-2" onSubmit={event => {
      event.preventDefault();
      const fields = event.currentTarget.elements;
      mutate(`/tags/${tag.id}`, 'PATCH', { name: (fields.namedItem('name') as HTMLInputElement).value, color: (fields.namedItem('color') as HTMLInputElement).value });
    }}>
      <label className="block text-sm">Tag name<input name="name" defaultValue={tag.name} className="block w-full rounded border border-current/20 p-2" /></label>
      <label className="flex items-center gap-2 text-sm">Tag color<input name="color" type="color" defaultValue={tag.color} /></label>
      <div className="flex justify-between"><button type="submit">Save tag</button><button type="button" className="text-red-700 dark:text-red-300" onClick={() => mutate(`/tags/${tag.id}`, 'DELETE')}>Delete tag</button></div>
    </form>)}
    <form className="space-y-2" onSubmit={event => {
      event.preventDefault();
      const form = event.currentTarget;
      const fields = form.elements;
      mutate('/tags', 'POST', { name: (fields.namedItem('name') as HTMLInputElement).value, color: (fields.namedItem('color') as HTMLInputElement).value }, () => form.reset());
    }}>
      <label className="block text-sm">New tag name<input name="name" className="block w-full rounded border border-current/20 p-2" /></label>
      <label className="flex items-center gap-2 text-sm">New tag color<input name="color" type="color" defaultValue="#627b54" /></label>
      <button type="submit">Add tag</button>
    </form>
  </section>;
}
