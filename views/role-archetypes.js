// Curated role-based search targets. These never describe actual candidates.
export const roleArchetypes={
  "Head of Trading": {
    "mandate": "Lead a trading desk with clear strategy ownership, execution standards and risk accountability.",
    "focus": [
      "Trading strategy",
      "Execution quality",
      "Desk risk"
    ],
    "experience": [
      "Leading traders or systematic strategies across relevant products and venues.",
      "Reviewing execution costs, market impact and trading performance.",
      "Owning desk limits, escalation and operational controls."
    ],
    "question": "Which strategies, products and risk budget will this desk own?"
  },
  "Head of Market Making": {
    "mandate": "Lead systematic liquidity provision with disciplined pricing, inventory and venue risk.",
    "focus": [
      "Electronic market making",
      "Pricing and inventory",
      "Liquidity risk"
    ],
    "experience": [
      "Leading an electronic market-making desk or systematic liquidity strategies.",
      "Managing quote quality, spreads, inventory exposure and adverse selection.",
      "Working with quant research and engineering on venue connectivity, hedging and trading controls."
    ],
    "question": "Which venues, instruments, inventory limits and liquidity obligations define this mandate?"
  },
  "Head of Quantitative Research": {
    "mandate": "Lead a research agenda that connects robust signals with deployable trading strategies.",
    "focus": [
      "Signal research",
      "Research validation",
      "Production hand-off"
    ],
    "experience": [
      "Leading quantitative researchers through hypothesis design and empirical testing.",
      "Controlling data leakage, overfitting and research reproducibility.",
      "Working with trading and engineering to evaluate live behaviour against research assumptions."
    ],
    "question": "Which research horizon, data advantage and deployment constraints matter most?"
  },
  "Portfolio Manager": {
    "mandate": "Own an investment mandate within an agreed risk budget and investment process.",
    "focus": [
      "Portfolio construction",
      "Risk allocation",
      "Investment discipline"
    ],
    "experience": [
      "Managing a relevant investment strategy with explicit decision rights.",
      "Assessing position sizing, liquidity, drawdown and concentration risk.",
      "Explaining attribution and portfolio decisions to investment and risk stakeholders."
    ],
    "question": "What capital allocation, risk limits and investment horizon will apply?"
  },
  "Principal Quantitative Engineer": {
    "mandate": "Build reliable research and trading systems that connect quantitative work to production.",
    "focus": [
      "Quantitative systems",
      "Research tooling",
      "Production reliability"
    ],
    "experience": [
      "Building research infrastructure, data pipelines or trading systems in relevant markets.",
      "Working with researchers on simulation fidelity, testing and reproducibility.",
      "Owning performance, observability and failure recovery for critical systems."
    ],
    "question": "Where does the role sit between research infrastructure and live trading?"
  },
  "Chief AI Officer": {
    "mandate": "Set an AI strategy tied to business outcomes, model governance and delivery accountability.",
    "focus": [
      "AI strategy",
      "Model governance",
      "Business adoption"
    ],
    "experience": [
      "Setting an AI investment agenda across a complex organisation.",
      "Building leadership across research, engineering, data and risk.",
      "Defining evaluation, deployment and oversight standards for material use cases."
    ],
    "question": "Which business decisions should AI improve, and who owns the associated risk?"
  },
  "Head of AI": {
    "mandate": "Lead an AI team from use-case selection through evaluated production delivery.",
    "focus": [
      "AI delivery",
      "Evaluation standards",
      "Research leadership"
    ],
    "experience": [
      "Leading applied AI or machine-learning teams on relevant business problems.",
      "Defining evaluation datasets, model-quality thresholds and release criteria.",
      "Working with product, data and platform teams on adoption and monitoring."
    ],
    "question": "Which use cases need research depth, and which need dependable execution?"
  },
  "Head of Data": {
    "mandate": "Build trusted data foundations with clear ownership, quality and access controls.",
    "focus": [
      "Data governance",
      "Data platforms",
      "Data quality"
    ],
    "experience": [
      "Leading data engineering, governance or analytics in a relevant environment.",
      "Establishing lineage, ownership, quality controls and access policies.",
      "Delivering reliable datasets for trading, investment, product or regulatory needs."
    ],
    "question": "Which data products and control gaps must this person own?"
  },
  "Principal Machine Learning Engineer": {
    "mandate": "Build and operate machine-learning systems with rigorous evaluation and reliable serving.",
    "focus": [
      "ML engineering",
      "Model evaluation",
      "Production operations"
    ],
    "experience": [
      "Deploying models into consequential production workflows.",
      "Building training, feature, serving and monitoring infrastructure.",
      "Diagnosing drift, latency, reproducibility and operational failure modes."
    ],
    "question": "What evaluation, latency and reliability requirements must the system meet?"
  },
  "Chief Technology Officer": {
    "mandate": "Set the technology direction and build the leadership capacity to deliver it.",
    "focus": [
      "Technology strategy",
      "Engineering leadership",
      "Platform resilience"
    ],
    "experience": [
      "Setting architecture and investment priorities against a commercial roadmap.",
      "Building senior engineering leadership and clear technical ownership.",
      "Balancing platform scale, security, reliability and delivery discipline."
    ],
    "question": "Which technical constraints are limiting the business today?"
  },
  "VP Engineering": {
    "mandate": "Turn the technology roadmap into accountable engineering execution.",
    "focus": [
      "Engineering delivery",
      "Team leadership",
      "Operating cadence"
    ],
    "experience": [
      "Leading multiple engineering teams and managers.",
      "Improving delivery planning, quality and cross-team dependency management.",
      "Developing engineering leadership and a sustainable operating cadence."
    ],
    "question": "Which teams, delivery commitments and management layers will this role own?"
  },
  "Head of Engineering": {
    "mandate": "Lead an engineering organisation with clear delivery and technical standards.",
    "focus": [
      "Technical delivery",
      "Engineering standards",
      "People development"
    ],
    "experience": [
      "Managing engineers and technical leads across relevant systems.",
      "Owning delivery commitments, incident learning and code-quality standards.",
      "Working with product and infrastructure teams on priorities and capacity."
    ],
    "question": "What is the balance between hands-on technical leadership and people management?"
  },
  "Chief Information Security Officer": {
    "mandate": "Own security strategy, assurance and incident readiness against the business threat model.",
    "focus": [
      "Security governance",
      "Cyber resilience",
      "Incident leadership"
    ],
    "experience": [
      "Leading security programmes in environments with sensitive systems and data.",
      "Setting security architecture, assurance and third-party risk priorities.",
      "Directing incident readiness and communicating material risk to executives."
    ],
    "question": "Which threats and assurance obligations define the security mandate?"
  },
  "Chief Revenue Officer": {
    "mandate": "Own the revenue system across acquisition, expansion and commercial execution.",
    "focus": [
      "Revenue strategy",
      "Commercial leadership",
      "Revenue operations"
    ],
    "experience": [
      "Leading revenue teams with clear acquisition and expansion ownership.",
      "Aligning sales, partnerships and customer success around account priorities.",
      "Reviewing pipeline quality, forecast discipline and commercial economics."
    ],
    "question": "Which revenue lines, regions and commercial teams report into this role?"
  },
  "Chief Commercial Officer": {
    "mandate": "Set the commercial direction across products, markets and strategic relationships.",
    "focus": [
      "Commercial strategy",
      "Strategic relationships",
      "Market expansion"
    ],
    "experience": [
      "Owning commercial priorities, pricing or market-entry decisions.",
      "Building senior customer and strategic partner relationships.",
      "Aligning commercial commitments with product, risk and operating capacity."
    ],
    "question": "Where does this mandate differ from sales leadership alone?"
  },
  "VP Sales": {
    "mandate": "Lead a sales organisation with disciplined execution in the target client segment.",
    "focus": [
      "Sales leadership",
      "Pipeline discipline",
      "Account strategy"
    ],
    "experience": [
      "Leading sales managers or senior sellers in a relevant buying environment.",
      "Building account plans, qualification standards and forecast discipline.",
      "Developing repeatable sales execution for complex buying decisions."
    ],
    "question": "Which customer segment, sales cycle and territory model must this leader understand?"
  },
  "Head of Business Development": {
    "mandate": "Develop partnerships and new commercial opportunities with a clear route to value.",
    "focus": [
      "Partnership development",
      "Commercial structuring",
      "Opportunity qualification"
    ],
    "experience": [
      "Building relevant institutional or ecosystem relationships.",
      "Qualifying opportunities and structuring partnership economics.",
      "Coordinating product, legal and operational stakeholders through execution."
    ],
    "question": "Is success defined by distribution, strategic partnerships or direct revenue?"
  },
  "Chief Product Officer": {
    "mandate": "Own product direction across the portfolio and connect it to commercial priorities.",
    "focus": [
      "Product strategy",
      "Portfolio decisions",
      "Product leadership"
    ],
    "experience": [
      "Leading product organisations with multiple products or customer segments.",
      "Making portfolio choices using customer evidence and commercial context.",
      "Aligning product, design, engineering and go-to-market leadership."
    ],
    "question": "Which portfolio decisions and product outcomes belong to this role?"
  },
  "VP Product": {
    "mandate": "Translate product strategy into a prioritised roadmap and a strong product organisation.",
    "focus": [
      "Roadmap ownership",
      "Product management",
      "Customer evidence"
    ],
    "experience": [
      "Leading product managers across complex products or domains.",
      "Setting prioritisation, discovery and product-measurement standards.",
      "Managing roadmap dependencies with engineering and commercial teams."
    ],
    "question": "What product domains and team scope sit within the mandate?"
  },
  "Head of Product": {
    "mandate": "Lead product development for a defined business domain or platform.",
    "focus": [
      "Domain expertise",
      "Product discovery",
      "Delivery alignment"
    ],
    "experience": [
      "Owning a product domain with relevant customer and workflow complexity.",
      "Validating requirements with users and commercial stakeholders.",
      "Making explicit trade-offs across scope, risk and delivery capacity."
    ],
    "question": "Which customer problem and product decisions will this person own?"
  },
  "Head of Strategy": {
    "mandate": "Build a decision-ready strategy agenda with clear execution ownership.",
    "focus": [
      "Strategic analysis",
      "Executive decisions",
      "Execution planning"
    ],
    "experience": [
      "Leading market, competitive and business-model analysis.",
      "Preparing investment or growth decisions for senior stakeholders.",
      "Translating chosen priorities into accountable programmes."
    ],
    "question": "Does the role own corporate strategy, business development or transformation?"
  },
  "Chief Risk Officer": {
    "mandate": "Set the risk framework and challenge material decisions with independent judgement.",
    "focus": [
      "Enterprise risk",
      "Risk appetite",
      "Board oversight"
    ],
    "experience": [
      "Leading relevant financial, market, credit or operational risk functions.",
      "Defining appetite, limits, escalation and risk reporting.",
      "Providing independent challenge to executive and board decisions."
    ],
    "question": "Which risk types and regulated entities will fall within this remit?"
  },
  "Chief Compliance Officer": {
    "mandate": "Own the compliance framework and senior regulatory accountability.",
    "focus": [
      "Regulatory leadership",
      "Compliance governance",
      "Regulatory engagement"
    ],
    "experience": [
      "Leading compliance in relevant regulated products and jurisdictions.",
      "Designing governance, monitoring and regulatory-change programmes.",
      "Engaging regulators and advising senior leaders on material obligations."
    ],
    "question": "Which jurisdictions, licences and accountable responsibilities must be covered?"
  },
  "Head of Compliance": {
    "mandate": "Lead day-to-day compliance delivery for the relevant regulated business.",
    "focus": [
      "Compliance operations",
      "Monitoring frameworks",
      "Regulatory change"
    ],
    "experience": [
      "Managing compliance teams and practical control programmes.",
      "Owning monitoring, policy implementation and issue remediation.",
      "Advising business teams on applicable regulatory requirements."
    ],
    "question": "Which compliance responsibilities remain with the CCO or other accountable officers?"
  },
  "Head of Financial Crime": {
    "mandate": "Lead financial-crime controls matched to the business, customers and transaction risks.",
    "focus": [
      "AML and sanctions",
      "Financial-crime controls",
      "Investigation governance"
    ],
    "experience": [
      "Leading relevant AML, sanctions or financial-crime programmes.",
      "Overseeing customer-risk assessment, monitoring and case escalation.",
      "Working with compliance, operations and engineering on control effectiveness."
    ],
    "question": "Does this role include a formally appointed reporting-officer responsibility?"
  },
  "Chief Operating Officer": {
    "mandate": "Own the operating model and execution discipline needed to support the business.",
    "focus": [
      "Operating model",
      "Operational resilience",
      "Cross-functional execution"
    ],
    "experience": [
      "Leading complex operations across relevant products or locations.",
      "Setting decision rights, service standards and resilience priorities.",
      "Coordinating business, technology, finance and control functions."
    ],
    "question": "Which functions and operating outcomes are directly accountable to the COO?"
  },
  "Chief Financial Officer": {
    "mandate": "Own financial strategy, stewardship and decision support for the next business stage.",
    "focus": [
      "Financial stewardship",
      "Capital planning",
      "Executive finance"
    ],
    "experience": [
      "Leading finance through relevant growth, funding or organisational complexity.",
      "Owning planning, reporting, treasury and financial control priorities.",
      "Advising the board on capital allocation and business economics."
    ],
    "question": "Which capital, reporting and control priorities define the first year?"
  },
  "Head of Operations": {
    "mandate": "Lead reliable operational delivery with clear control and escalation standards.",
    "focus": [
      "Operational delivery",
      "Process controls",
      "Service resilience"
    ],
    "experience": [
      "Managing operational teams in relevant transaction or service workflows.",
      "Strengthening reconciliation, exception management and control ownership.",
      "Improving service performance while managing operational incidents."
    ],
    "question": "Which workflows, service commitments and failure risks require ownership?"
  },
  "Finance Director": {
    "mandate": "Lead the finance function with reliable reporting, planning and control.",
    "focus": [
      "Financial reporting",
      "Planning and analysis",
      "Finance operations"
    ],
    "experience": [
      "Leading accounting, reporting or finance teams at a comparable level.",
      "Managing budgeting, close processes and management information.",
      "Strengthening controls and supporting operational business decisions."
    ],
    "question": "Which statutory, management-reporting and commercial-finance responsibilities apply?"
  },
  "Chief Executive Officer": {
    "mandate": "Set the business direction and build the leadership team accountable for delivery.",
    "focus": [
      "Business strategy",
      "Executive leadership",
      "Board alignment"
    ],
    "experience": [
      "Leading a business with relevant market and operating complexity.",
      "Aligning the board, shareholders and leadership team on priorities.",
      "Owning commercial performance, resource allocation and organisational direction."
    ],
    "question": "What authority, ownership context and first-year outcomes define the CEO mandate?"
  },
  "Managing Director": {
    "mandate": "Lead a business or division with clear commercial and operational accountability.",
    "focus": [
      "Business leadership",
      "Commercial ownership",
      "Organisational execution"
    ],
    "experience": [
      "Leading a relevant division, region or business unit.",
      "Owning commercial priorities and cross-functional operating performance.",
      "Managing senior stakeholder relationships and leadership accountability."
    ],
    "question": "Is the remit a legal entity, region, division or product business?"
  },
  "General Manager": {
    "mandate": "Own the performance and coordination of a defined business unit.",
    "focus": [
      "Business-unit delivery",
      "Operational coordination",
      "Commercial performance"
    ],
    "experience": [
      "Running a relevant business unit with a defined customer and operating remit.",
      "Coordinating commercial, product and operational teams.",
      "Managing budgets, priorities and performance against agreed targets."
    ],
    "question": "Which decisions, resources and results sit within the business-unit boundary?"
  },
  "Chief People Officer": {
    "mandate": "Build the people strategy and leadership infrastructure for the business stage.",
    "focus": [
      "People strategy",
      "Leadership development",
      "Organisation design"
    ],
    "experience": [
      "Leading people functions through relevant growth or organisational change.",
      "Advising executives on organisation design, succession and reward.",
      "Building management standards, workforce planning and employee relations."
    ],
    "question": "Which organisational changes and leadership gaps must this role address?"
  }
};
export function targetArchetype(role,niche,location){
 const profile=roleArchetypes[role];if(!profile)throw Error('Unsupported target role');
 return {...profile,role,niche,location,kind:'synthetic',label:'search preview',baseFocus:'Mandate focus: US$150,000+ annual base. A tailored benchmark is still required.',pillars:profile.focus.map((title,index)=>[title,profile.experience[index]])};
}
