import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"
import { pricingFaqs } from "./pricing-content"

export const PricingFaq = () => (
  <section id="faq" className="scroll-mt-20 pt-16 pb-24 md:pt-24 md:pb-32">
    <div className="mx-auto flex max-w-2xl flex-col gap-10">
      <h2 className="text-center text-3xl font-normal tracking-tight md:text-4xl">
        FAQ
      </h2>
      <Accordion className="w-full overflow-visible rounded-none border-0">
        {pricingFaqs.map((faq) => (
          <AccordionItem
            key={faq.value}
            value={faq.value}
            className="border-border/50 data-open:bg-transparent"
          >
            <AccordionTrigger className="py-5 text-left text-sm font-normal hover:no-underline">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-sm leading-6 text-muted-foreground">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
)
