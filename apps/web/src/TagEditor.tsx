type Tag = { id: string; name: string; color: string };
type Mutate = (path: string, method: string, body?: unknown, after?: () => void) => void;

export function TagEditor({ tags, mutate }: { tags: Tag[]; mutate: Mutate }) {
  return <section aria-label="Edit tags" className="space-y-6">
    <h3 className="type-h2">Edit tags</h3>
    {tags.map(tag => <form key={`${tag.id}-${tag.name}-${tag.color}`} aria-label={tag.name} role="group" className="inner-panel space-y-4" onSubmit={event => {
      event.preventDefault();
      const fields = event.currentTarget.elements;
      mutate(`/tags/${tag.id}`, 'PATCH', { name: (fields.namedItem('name') as HTMLInputElement).value, color: (fields.namedItem('color') as HTMLInputElement).value });
    }}>
      <label className="type-label block">Tag name<input name="name" defaultValue={tag.name} className="field mt-2 block" /></label>
      <label className="type-label flex items-center gap-2">Tag color<input name="color" type="color" className="color-swatch" defaultValue={tag.color} /></label>
      <div className="flex flex-wrap gap-3"><button type="submit" className="button-secondary">Save tag</button><button type="button" className="button-destructive" onClick={() => mutate(`/tags/${tag.id}`, 'DELETE')}>Delete tag</button></div>
    </form>)}
    <form className="space-y-4" onSubmit={event => {
      event.preventDefault();
      const form = event.currentTarget;
      const fields = form.elements;
      mutate('/tags', 'POST', { name: (fields.namedItem('name') as HTMLInputElement).value, color: (fields.namedItem('color') as HTMLInputElement).value }, () => form.reset());
    }}>
      <label className="type-label block">New tag name<input name="name" className="field mt-2 block" /></label>
      <label className="type-label flex items-center gap-2">New tag color<input name="color" type="color" className="color-swatch" defaultValue={getComputedStyle(document.documentElement).getPropertyValue('--color-accent-text').trim()} /></label>
      <button type="submit" className="button-secondary">Add tag</button>
    </form>
  </section>;
}
