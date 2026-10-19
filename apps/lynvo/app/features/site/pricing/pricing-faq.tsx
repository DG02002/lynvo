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
      <h2 className="text-center text-3xl font-normal md:text-4xl">FAQ</h2>
      <Accordion variant="plain" className="w-full overflow-visible">
        {pricingFaqs.map((faq) => (
          <AccordionItem key={faq.value} value={faq.value}>
            <AccordionTrigger variant="quiet">{faq.question}</AccordionTrigger>
            <AccordionContent variant="muted">{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
)
