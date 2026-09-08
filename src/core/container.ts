import { EventBus } from './events/eventBus';
import { JobQueue } from './jobs/jobQueue';
import { JobHandlerRegistry } from './jobs/jobHandlerRegistry';
import { JobWorker } from './jobs/jobWorker';
import { ToolRegistry } from './tools/toolRegistry';
import { Orchestrator } from './ai/orchestrator';
import { AdapterRegistry } from './integrations/adapterRegistry';
import { getTenantInfoTool } from './tools/builtin/getTenantInfoTool';
import { listUsersTool } from './tools/builtin/listUsersTool';
import { createSearchProductsTool } from './tools/builtin/searchProductsTool';
import { defineNotImplementedTool } from './tools/builtin/notImplementedTool';

// Section 9 of the architecture plan lists these generic business tools.
// search_products is implemented for real (wired to the adapter layer);
// the rest are registered as named, discoverable stubs until the batch
// that implements each arrives, per the "never fake functionality" rule.
const PLANNED_TOOL_STUBS: Array<{ name: string; description: string }> = [
  { name: 'get_product', description: 'Get a single product by ID.' },
  { name: 'check_inventory', description: 'Check stock level for a product.' },
  { name: 'search_customers', description: 'Search customers by name/email/phone.' },
  { name: 'get_customer', description: 'Get a single customer by ID.' },
  { name: 'create_customer', description: 'Create a new customer record.' },
  { name: 'search_orders', description: 'Search orders by customer, status, or date range.' },
  { name: 'get_order', description: 'Get a single order by ID.' },
  { name: 'create_order', description: 'Create a new order.' },
  { name: 'cancel_order', description: 'Cancel an existing order.' },
  { name: 'add_to_cart', description: "Add a product to a customer's cart." },
  { name: 'apply_coupon', description: 'Apply a coupon code to a cart or order.' },
  { name: 'calculate_shipping', description: 'Calculate shipping cost for a cart/address.' },
  { name: 'search_knowledge', description: "Search the tenant's knowledge base." },
  { name: 'send_email', description: 'Send a transactional or marketing email.' },
  { name: 'send_whatsapp', description: 'Send a WhatsApp message.' },
  { name: 'create_campaign', description: 'Create a marketing campaign.' },
  { name: 'get_sales_report', description: 'Get a sales report for a date range.' },
  { name: 'create_ticket', description: 'Create a support ticket.' },
  { name: 'escalate_to_human', description: 'Escalate the current conversation to a human agent.' },
  { name: 'create_content', description: 'Create a content draft (blog post, product copy, etc.).' },
  { name: 'publish_content', description: 'Publish a content item.' },
];

export interface Container {
  eventBus: EventBus;
  jobQueue: JobQueue;
  jobHandlers: JobHandlerRegistry;
  jobWorker: JobWorker;
  toolRegistry: ToolRegistry;
  orchestrator: Orchestrator;
  adapterRegistry: AdapterRegistry;
}

export function buildContainer(): Container {
  const eventBus = new EventBus();
  const jobQueue = new JobQueue();
  const jobHandlers = new JobHandlerRegistry();
  const jobWorker = new JobWorker(jobHandlers);
  const toolRegistry = new ToolRegistry();
  const adapterRegistry = new AdapterRegistry();
  const orchestrator = new Orchestrator(toolRegistry, eventBus);

  toolRegistry.register(getTenantInfoTool);
  toolRegistry.register(listUsersTool);
  toolRegistry.register(createSearchProductsTool(adapterRegistry));
  for (const stub of PLANNED_TOOL_STUBS) {
    toolRegistry.register(defineNotImplementedTool(stub.name, stub.description));
  }

  // Demonstration job handler — proves the queue/worker mechanics work
  // end to end. Real job types (abandoned-cart reminders, etc.) arrive
  // with the batches that need them.
  jobHandlers.register('demo.echo', async (job) => {
    return { echoed: job.payload };
  });

  return { eventBus, jobQueue, jobHandlers, jobWorker, toolRegistry, orchestrator, adapterRegistry };
}

// Single shared instance for the running process (API server, worker script, or tests).
export const container = buildContainer();
