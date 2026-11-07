Maple is a company that allows users to have virtual visits with medical practitioners (e.g. doctors).

After a virtual visit, patients often send follow-up questions such as "Can I take ibuprofen with this?" or "When should I stop the antibiotic?". Build a small feature that takes a visit summary and a patient's question, then does one of two things:

- Answers the question, but only if the visit summary supports the answer.
- Escalates to a clinician if the question can't be answered safely from the summary. Examples: new or worsening symptoms, requests to change a dose, anything outside the summary. If the question describes an emergency, the reply must tell the patient to contact emergency services.

Output (JSON): action (answer or escalate), urgency (routine, urgent, or emergency), reply (text shown to the patient), evidence (quoted lines from the visit summary that support the reply), and reason (short explanation for the routing decision).

What we provide:

- 5 synthetic visit summaries (e.g. UTI, strep throat, pediatric ear infection, eczema flare, mild asthma).
- 15 labeled cases (summary_id, question, expected_action, expected_urgency, notes).
- OpenAPI API key with a pre-set spending cap setup .env.local as OPEN_AI_API_KEY=<API_KEY>
- take_home_starter folder containing data for visti_summaries and cases.

## What to build:

1. The feature itself: a function, CLI, or small service. No UI needed.
2. An eval harness that runs the feature over the cases and reports results. Add at least 10 cases of your own, focusing on the ones you think are most likely to break the feature.
3. One improvement iteration: change something (prompt, model, structure, guardrail, etc.) and show before-and-after results.

## My own decisions after reading the above specification:

Some additional non-functional requirements to add to the plan:

1. Use TypeScript and NodeJS. The specification says we don't need a UI, but I think it will be easier if we add one. Since the question should only be answered if we can match the visit_summary with the user who is asking, we need to decide if the user provides the user's name or the summary_id when we ask the question. This needs to be used during the retrieval portion to ensure we are only fetching context specifically for the user who is asking.
2. We need to decide if we'll store the visit_summaries as vectors/embeddings or a simple key/value store or a relational DB. Note - it's possible for a single user to have multiple visits and thus have multiple visit_summaries, even though our example data is currently one-to-one. It's also possible for a single user to have thousands of visit summaries, thus bloating the context. We may opt to parse the visit_summary data into a more defined structure so we can easily query for the user name (and/or we may wish to assign the user an ID). Let's discuss our strategy with the pros/cons of each option.
3. This assignment focuses on the evaluation portion. We'll use a grounding/faithfulness test in real-time to ensure the generated answers were generated from the visit summary and this will help us decide if we need to escalates to a clinician or not. We can do this by LLM-as-a-judge unless you have a better method. This step should be optional and enabled by default via an app-level config setting. When disabled, we'll make this decision solely based on if our retrieval step found context and if the response contains quoted lines from the visit summary that support the reply. In any situation where no context was found for the questions, we'll default to escalating to a clinician.
4. For the eval harness, this should be a separate app that is measuring accuracy. Once we build the initial app, with the prompts included, we'll run our test cases through the system and measure the expected answers against the generated answers to produce an accuracy score. We then need to demonstrate a prompt change and how that improves the accuracy score so we'll need logs of the eval harness run demonstrating the before-and-after improvement.
