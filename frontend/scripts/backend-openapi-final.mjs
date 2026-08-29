import { openapi as base } from './backend-openapi.mjs'
import { extensionPaths, extensionSchemas, extensionParameters, extensionResponses } from './backend-contract-extensions.mjs'

const openapi = {
  ...base,
  tags: [...base.tags, { name: 'payments' }, { name: 'feedback' }],
  paths: { ...base.paths, ...extensionPaths },
  components: {
    ...base.components,
    securitySchemes: {
      ...base.components.securitySchemes,
      wechatPaySignature: { type: 'apiKey', in: 'header', name: 'Wechatpay-Signature', description: 'Verify the complete WeChat Pay notification signature and certificate serial.' }
    },
    schemas: { ...base.components.schemas, ...extensionSchemas },
    parameters: { ...base.components.parameters, ...extensionParameters },
    responses: { ...base.components.responses, ...extensionResponses }
  }
}

export { openapi }
