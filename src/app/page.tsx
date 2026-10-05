import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-6">Next.js Template</h1>
      <p className="text-lg mb-6">
        This template demonstrates the new architecture with barrel exports and services layer.
      </p>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Components</h2>
        <div className="flex gap-4">
          <Button variant="default">Default Button</Button>
          <Button variant="secondary">Secondary Button</Button>
          <Button variant="outline">Outline Button</Button>
        </div>
      </div>
    </div>
  );
}
